from __future__ import annotations

CANONICAL_LABELS = ["Mild", "Moderate", "Severe"]
LABEL_TO_KEY = {"Mild": "mild", "Moderate": "moderate", "Severe": "severe"}
MODEL_ALIASES = {
    "ESG": ["esg", "electra", "electra_finetuned", "electra-small-generator"],
    "ABV": ["abv", "albert", "albert_finetuned", "albert-base-v2"],
    "XDL": ["xdl", "xtremedistil", "xtreme", "distil", "xtremedistil_finetuned"],
}
REGIONS = ["India", "USA", "UK", "Canada", "Australia"]
