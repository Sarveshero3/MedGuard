import httpx
from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, END
from app.config import settings
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage


class CritiqueResearchState(TypedDict):
    generic_a: str
    generic_b: str
    severity: str
    explanation: str
    critique_iterations: int
    research_summary: str
    is_valid: bool


def research_generic_interactions_node(state: CritiqueResearchState) -> Dict[str, Any]:
    gen_a = state.get("generic_a", "")
    gen_b = state.get("generic_b", "")

    # 1. Check database first via ms1 API
    try:
        url = f"{settings.ms1_base_url}/api/medicines/check-interaction"
        response = httpx.get(url, params={"generic_a": gen_a, "generic_b": gen_b}, timeout=10.0)
        if response.status_code == 200:
            res_data = response.json()
            if res_data.get("success") and res_data.get("exists"):
                interaction = res_data["interaction"]
                return {
                    "severity": interaction["severity"],
                    "explanation": interaction["explanation"],
                    "research_summary": f"Deterministic interaction check loaded from database for {gen_a} and {gen_b}.",
                    "is_valid": True  # Directly valid, no need to critique since it's deterministic
                }
    except Exception:
        # If the ms1 API connection fails, continue to LLM research fallback
        pass

    # 2. If not found in interaction_kb, research it via GLM-5.2 (disambiguation_model)
    client = get_client(settings.disambiguation_model)

    prompt = f"""
    Research the drug-drug interaction between the generic molecules '{gen_a}' and '{gen_b}' and write a structured summary.
    
    You MUST format your output with EXACTLY these 4 sections in this exact order:
    
    Patient Summary:
    Provide a comforting, reassuring, 1-2 sentence explanation of the concern and what the patient should do in plain, simple English (avoiding medical jargon or scary terms).
    
    **Mechanism of Interaction**
    Provide a 1-2 lines maximum explanation of the interaction mechanism in simple, patient-friendly terms. Fold any essential kinetics details into this section.
    
    **Clinically Significant Interactions**
    List the key interaction warnings in short bullet points with tight, concise phrasing.
    
    **Side Effects and Contraindications**
    List the key side effects and contraindications when taken together in short, concise bullet points.
    
    Do NOT include any technical jargon, enzyme names (like CYP), or scary medical terms. Speak directly to the patient in a clear, comforting way.
    """

    response = client.invoke([
        SystemMessage(content="You are a senior medical communicator. Research drug-drug interactions and explain them in clear, comforting, and layperson-friendly English for patients, avoiding scary terminology or jargon. Always use the specified 4 headers: Patient Summary:, **Mechanism of Interaction**, **Clinically Significant Interactions**, and **Side Effects and Contraindications**."),
        HumanMessage(content=prompt)
    ])

    explanation = response.content.strip()

    return {
        "severity": "unknown",  # Flag as unknown: needs user confirmation rather than guessing severity
        "explanation": explanation,
        "research_summary": f"Automated literature research completed for {gen_a} and {gen_b}.",
        "is_valid": False  # Force to critique first
    }


def critique_findings_node(state: CritiqueResearchState) -> Dict[str, Any]:
    gen_a = state.get("generic_a", "")
    gen_b = state.get("generic_b", "")
    explanation = state.get("explanation", "")
    iterations = state.get("critique_iterations", 0)

    if state.get("is_valid", False) or iterations >= 2:
        return {
            "is_valid": True,
            "critique_iterations": iterations + 1
        }

    client = get_client(settings.disambiguation_model)

    critique_prompt = f"""
    Analyze the following drug-drug interaction research finding between '{gen_a}' and '{gen_b}':
    
    Research Findings:
    {explanation}
    
    Verify:
    1. Does it accurately identify the drug classes for both '{gen_a}' and '{gen_b}'?
    2. Did it miss any crucial synonyms or related warnings?
    3. Is the explanation patient-friendly, comforting, and clear? Does it avoid technical jargon like enzyme names or scary medical terms?
    4. Does it strictly follow the requested structure:
       - Patient Summary: (1-2 sentences, plain reassuring English)
       - **Mechanism of Interaction** (1-2 lines max, simple)
       - **Clinically Significant Interactions** (short concise bullet points)
       - **Side Effects and Contraindications** (concise, non-alarmist)
       With NO other sections?
    
    If the findings are fully correct, accurate, and follow this structure exactly, respond with exactly: VALID.
    If there are inaccuracies, technical jargon, formatting/structural violations, or alarmist terms, provide a revised explanation correcting these details.
    """

    response = client.invoke([
        SystemMessage(content="You are a senior patient safety reviewer auditing drug interaction warnings. Ensure the description is written in a comforting, non-alarmist, plain English format for patients, with zero technical jargon. Ensure the output strictly follows the 4 specified headers and length limits."),
        HumanMessage(content=critique_prompt)
    ])

    res_text = response.content.strip()

    if "VALID" in res_text:
        return {
            "is_valid": True,
            "critique_iterations": iterations + 1
        }
    else:
        # Cap at 2 iterations (so mark as valid on second pass to exit)
        is_cap = (iterations >= 1)
        return {
            "is_valid": is_cap,
            "explanation": res_text,
            "critique_iterations": iterations + 1
        }


def critique_router(state: CritiqueResearchState):
    if state.get("is_valid", False) or state.get("critique_iterations", 0) >= 3:
        return "end"
    return "research_node"


workflow = StateGraph(CritiqueResearchState)
workflow.add_node("research_node", research_generic_interactions_node)
workflow.add_node("critique_node", critique_findings_node)

workflow.set_entry_point("research_node")
workflow.add_edge("research_node", "critique_node")
workflow.add_conditional_edges(
    "critique_node",
    critique_router,
    {
        "research_node": "research_node",
        "end": END
    }
)

critique_research_graph = workflow.compile()
