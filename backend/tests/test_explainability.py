from backend.app.services.explainability import LimeExplainerService


class DummyPredictor:
    def predict_proba(self, texts):
        return [[0.7, 0.2, 0.1] for _ in texts]


class FakeExplanation:
    def __init__(self):
        self.label_requested = None

    def as_list(self, label):
        self.label_requested = label
        return [("hope", 0.42)]


class FakeExplainer:
    def __init__(self):
        self.call_kwargs = None
        self.explanation = FakeExplanation()

    def explain_instance(self, **kwargs):
        self.call_kwargs = kwargs
        return self.explanation


def test_explainer_requests_the_predicted_label():
    service = LimeExplainerService(
        predictor=DummyPredictor(),
        feature_count=4,
        num_samples=16,
    )
    fake_explainer = FakeExplainer()
    service.explainer = fake_explainer

    explanation = service.explain("I need help", "Mild")

    assert fake_explainer.call_kwargs["labels"] == (0,)
    assert fake_explainer.explanation.label_requested == 0
    assert explanation["max_abs_weight"] == 0.42
    assert explanation["tokens"] == [
        {
            "token": "hope",
            "weight": 0.42,
            "normalized_weight": 1.0,
            "magnitude": 1.0,
            "direction": "supports",
            "rank": 1,
        }
    ]
    assert explanation["supporting"][0]["token"] == "hope"
    assert explanation["opposing"] == []
