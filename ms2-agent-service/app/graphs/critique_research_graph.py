import httpx
from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, END
from app.config import settings
from langchain_nvidia_ai_endpoints import ChatNVIDIA
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

    # 2. If not found in interaction_kb, research it via GLM-5.2 (orchestrator_model)
    client = ChatNVIDIA(
        model=settings.orchestrator_model,
        api_key=settings.nvidia_api_key,
        temperature=0.0
    )
    
    prompt = f"""
    Research the drug-drug interaction between the generic molecules '{gen_a}' and '{gen_b}'.
    Identify if there are any clinically significant interactions, side effects, or contraindications when taken together.
    Provide a scientific, clinical explanation of the interaction mechanism (if any) and a summary of your findings.
    """
    
    response = client.invoke([
        SystemMessage(content="You are a clinical pharmacologist. Research drug-drug interactions objectively based on scientific literature."),
        HumanMessage(content=prompt)
    ])
    
    explanation = response.content.strip()
    
    return {
        "severity": "unknown", # Flag as unknown: needs user confirmation rather than guessing severity
        "explanation": explanation,
        "research_summary": f"Automated literature research completed for {gen_a} and {gen_b}.",
        "is_valid": False # Force to critique first
    }


def critique_findings_node(state: CritiqueResearchState) -> Dict[str, Any]:
    gen_a = state.get("generic_a", "")
    gen_b = state.get("generic_b", "")
    explanation = state.get("explanation", "")
    iterations = state.get("critique_iterations", 0)

    if state.get("is_valid", False) or iterations >= 1:
        return {
            "is_valid": True,
            "critique_iterations": iterations + 1
        }

    client = ChatNVIDIA(
        model=settings.orchestrator_model,
        api_key=settings.nvidia_api_key,
        temperature=0.0
    )
    
    critique_prompt = f"""
    Analyze the following drug-drug interaction research finding between '{gen_a}' and '{gen_b}':
    
    Research Findings:
    {explanation}
    
    Verify:
    1. Does it accurately identify the drug classes for both '{gen_a}' and '{gen_b}'?
    2. Did it miss any crucial synonyms or related warnings?
    3. Is the explanation clinically precise and clear?
    
    If the findings are fully correct, accurate, and scientifically backed, respond with exactly: VALID.
    If there are inaccuracies or missing drug-class context, provide a revised explanation correcting these details.
    """
    
    response = client.invoke([
        SystemMessage(content="You are a senior medical reviewer auditing drug safety descriptions. Correct any inaccuracies or missing drug-class/mechanism details."),
        HumanMessage(content=critique_prompt)
    ])
    
    res_text = response.content.strip()
    
    if "VALID" in res_text:
        return {
            "is_valid": True,
            "critique_iterations": iterations + 1
        }
    else:
        return {
            "is_valid": True, # Cap at 1 iteration (meaning this is the second and final pass, so we mark it as valid to exit)
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
