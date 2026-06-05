
import json

class ShapExplainerService:
    def explain(self, text, tokens, feature_weights):
        return {
            "text": text,
            "important_tokens": [t for t, w in zip(tokens, feature_weights) if abs(w) > 0.15],
            "global_base_value": 0.32
        }
