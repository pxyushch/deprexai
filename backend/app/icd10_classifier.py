
ICD10_MAP = {
    "F32.0": "Mild depressive episode",
    "F32.1": "Moderate depressive episode",
    "F32.2": "Severe depressive episode without psychotic symptoms",
    "F33": "Recurrent depressive disorder"
}

def map_icd10_criteria(severity_score):
    if severity_score < 0.35: return "F32.0"
    if severity_score < 0.70: return "F32.1"
    return "F32.2"
