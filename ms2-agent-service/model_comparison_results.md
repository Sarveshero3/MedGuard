# Brand-resolution model comparison

Date: 2026-07-18

## Decision

Use `llama-3.3-70b-versatile` for `BRAND_RESOLUTION_MODEL`. Do not use
`llama-3.1-8b-instant` for this safety-sensitive task.

The benchmark executes the same JSON-only, LLM-first prompt against reviewed
ground truth. Tavily is excluded so this measures model knowledge rather than
search quality. Ingredient aliases are normalized before exact set comparison.
The raw machine-readable results, including latency, are in
`model_comparison_results.json`.

| Metric | Llama 3.1 8B Instant | Llama 3.3 70B Versatile |
| --- | ---: | ---: |
| Correct | 8/20 | 17/20 |
| Incorrect/hallucinated | 12/20 | 3/20 |
| Unknown | 0/20 | 0/20 |
| API errors | 0/20 | 0/20 |
| Accuracy | 40% | 85% |
| Unsafe incorrect rate | 60% | 15% |

The 8B model was not merely less complete: it confidently introduced wrong
ingredients for common products including Crocin, Dolo 650, Amlong, Rosuvas,
Omez, Arkamin, Telma-H, and Foracort. That is unacceptable for interaction
checking. The 70B model also failed three cases, so every AI-derived mapping
remains a suggestion requiring user confirmation before append-only persistence.

## Full comparison

| Category | Brand | Reviewed generic | 8B result | 8B status | 70B result | 70B status |
| --- | --- | --- | --- | --- | --- | --- |
| OTC | Crocin | paracetamol | paracetamol + caffeine | Incorrect | paracetamol | Correct |
| OTC | Dolo 650 | paracetamol | paracetamol + caffeine | Incorrect | paracetamol | Correct |
| OTC | Combiflam | ibuprofen + paracetamol | ibuprofen + paracetamol | Correct | ibuprofen + paracetamol | Correct |
| OTC | Calpol 650 | paracetamol | paracetamol + paracetamol | Correct after set normalization | paracetamol | Correct |
| Prescription | Amlong 5 | amlodipine | amlodipine + valsartan | Incorrect | amlodipine | Correct |
| Prescription | Rosuvas 10 | rosuvastatin | amlodipine + valsartan | Incorrect | rosuvastatin | Correct |
| Prescription | Omez | omeprazole | omeprazole + domperidone | Incorrect | omeprazole | Correct |
| Prescription | Arkamin | clonidine | methylephedrine + naphazoline | Incorrect | clonidine | Correct |
| Prescription | Udiliv 300 | ursodeoxycholic acid | ursodiol + cholestyramine | Incorrect | ursodeoxycholic acid | Correct |
| Combination | Augmentin 625 | amoxicillin + clavulanic acid | amoxicillin + clavulanate | Correct | amoxicillin + clavulanic acid | Correct |
| Combination | Pan-D | pantoprazole + domperidone | pancrelipase + pancreatin + lipase + amylase + trypsin | Incorrect | dexpanthenol | Incorrect |
| Combination | Montek-LC | montelukast + levocetirizine | montelukast + levocetirizine | Correct | montelukast + levocetirizine | Correct |
| Combination | Janumet 50/1000 | sitagliptin + metformin | sitagliptin + metformin | Correct | sitagliptin + metformin | Correct |
| Combination | Telma-H | telmisartan + hydrochlorothiazide | amlodipine + valsartan | Incorrect | telmisartan + hydrochlorothiazide | Correct |
| Combination | Clavam 625 | amoxicillin + clavulanic acid | amoxicillin + clavulanate | Correct | amoxicillin + clavulanic acid | Correct |
| Combination | Glimisave M2 | glimepiride + metformin | metformin + voglibose | Incorrect | metformin + gliclazide | Incorrect |
| Combination | Ecosprin AV 75/10 | aspirin + atorvastatin | aspirin + atorvastatin | Correct | aspirin + atorvastatin | Correct |
| Combination | Foracort 200 | budesonide + formoterol | fluticasone + formoterol | Incorrect | budesonide + formoterol | Correct |
| Regional/obscure | Taxim-OF | cefixime + ofloxacin | ciprofloxacin + ofloxacin | Incorrect | cefixime | Incorrect |
| Regional/obscure | Shelcal 500 | calcium carbonate + vitamin D3 | calcium carbonate + vitamin D3 | Correct | calcium carbonate + vitamin D3 | Correct |

## Rate-limit conclusion

The prior comparison was invalid because 17 of 20 70B calls received HTTP 429.
This rerun completed all 40 calls without an API error. The application performs
one 70B direct attempt per uncached brand, with one JSON-format retry only when
parsing fails. Tavily is called only when the direct model returns `exists=false`
or an empty/`no such medicine found` generic. This bounded flow does not justify
accepting the 8B model's 60% incorrect rate. If quota pressure returns, use
caching, request budgeting, or a reviewed alternative model—not a silent model
downgrade.
