from __future__ import annotations

from lime.lime_text import LimeTextExplainer

from ..core.constants import CANONICAL_LABELS
from .prediction_service import EnsemblePredictor


class LimeExplainerService:
    def __init__(
        self,
        predictor: EnsemblePredictor,
        feature_count: int = 8,
        num_samples: int = 64,
    ) -> None:
        self.predictor = predictor
        self.feature_count = feature_count
        self.num_samples = num_samples
        self.explainer = LimeTextExplainer(class_names=CANONICAL_LABELS)

    def explain(self, text: str, predicted_label: str) -> dict[str, object]:
        label_index = CANONICAL_LABELS.index(predicted_label)
        explanation = self.explainer.explain_instance(
            text_instance=text,
            classifier_fn=self.predictor.predict_proba,
            num_features=self.feature_count,
            num_samples=self.num_samples,
            labels=(label_index,),
        )
        pairs = sorted(
            explanation.as_list(label=label_index),
            key=lambda pair: abs(pair[1]),
            reverse=True,
        )
        max_abs_weight = max((abs(weight) for _, weight in pairs), default=1.0) or 1.0
        tokens = []
        for rank, (token, weight) in enumerate(pairs, start=1):
            normalized = float(weight / max_abs_weight)
            tokens.append(
                {
                    "token": str(token),
                    "weight": float(weight),
                    "normalized_weight": normalized,
                    "magnitude": float(abs(normalized)),
                    "direction": "supports" if weight >= 0 else "opposes",
                    "rank": rank,
                }
            )

        supporting = [token for token in tokens if token["direction"] == "supports"]
        opposing = [token for token in tokens if token["direction"] == "opposes"]
        return {
            "tokens": tokens,
            "supporting": supporting,
            "opposing": opposing,
            "max_abs_weight": float(max_abs_weight),
        }
