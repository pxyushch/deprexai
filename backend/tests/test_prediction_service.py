import numpy as np

from backend.app.services.prediction_service import EnsemblePredictor


class StubModel:
    def __init__(self, alias: str, probabilities: list[float]) -> None:
        self.alias = alias
        self.display_name = alias
        self._probabilities = np.array([probabilities], dtype=np.float32)

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        return np.repeat(self._probabilities, len(texts), axis=0)

    def describe(self) -> dict[str, str]:
        return {"alias": self.alias}


class StubRegistry:
    def __init__(self, models: list[StubModel]) -> None:
        self._models = models

    def load_all(self) -> list[StubModel]:
        return self._models


def build_predictor(probabilities: list[list[float]]) -> EnsemblePredictor:
    models = [StubModel(f"stub-{index}", vector) for index, vector in enumerate(probabilities, start=1)]
    return EnsemblePredictor(registry=StubRegistry(models), strict_model_count=False, cache_size=16)


def test_recovery_language_rebalances_false_moderate_prediction():
    predictor = build_predictor(
        [
            [0.0001, 0.9994, 0.0005],
            [0.0007, 0.9923, 0.0070],
            [0.0007, 0.9923, 0.0070],
        ]
    )

    result = predictor.predict(
        "I am not depressed anymore. I feel much better now and I am enjoying life again."
    )

    assert result.calibration.applied is True
    assert result.calibration.raw_prediction == "Moderate"
    assert result.prediction == "Mild"
    assert result.probabilities["mild"] > result.probabilities["moderate"]


def test_short_positive_phrase_is_not_left_in_severe():
    predictor = build_predictor(
        [
            [0.3131, 0.0978, 0.5891],
            [0.3131, 0.0978, 0.5891],
            [0.3131, 0.0978, 0.5891],
        ]
    )

    result = predictor.predict("I very happy now")

    assert result.calibration.applied is True
    assert result.calibration.strategy == "short_positive_override"
    assert result.prediction == "Mild"
    assert result.probabilities["mild"] > result.probabilities["severe"]


def test_positive_wellbeing_phrase_is_not_left_in_severe():
    predictor = build_predictor(
        [
            [0.067, 0.039, 0.894],
            [0.067, 0.039, 0.894],
            [0.067, 0.039, 0.894],
        ]
    )

    result = predictor.predict("Life feels peaceful and I am grateful today.")

    assert result.calibration.applied is True
    assert result.calibration.strategy == "positive_language_override"
    assert result.prediction == "Mild"
    assert result.probabilities["mild"] > result.probabilities["severe"]


def test_positive_family_update_breaks_mild_severe_near_tie():
    predictor = build_predictor(
        [
            [0.441, 0.071, 0.488],
            [0.441, 0.071, 0.488],
            [0.441, 0.071, 0.488],
        ]
    )

    result = predictor.predict("I am doing well and enjoying time with my family.")

    assert result.calibration.applied is True
    assert result.calibration.strategy == "positive_language_override"
    assert result.prediction == "Mild"
    assert result.probabilities["mild"] > result.probabilities["severe"]


def test_positive_future_outlook_phrase_is_not_left_in_severe():
    predictor = build_predictor(
        [
            [0.3477, 0.0406, 0.6117],
            [0.3477, 0.0406, 0.6117],
            [0.3477, 0.0406, 0.6117],
        ]
    )

    result = predictor.predict("It is a very good day to start my future.")

    assert result.calibration.applied is True
    assert result.calibration.strategy == "positive_language_override"
    assert result.prediction == "Mild"
    assert result.probabilities["mild"] > result.probabilities["severe"]


def test_recovery_language_breaks_ambiguous_mild_severe_tie():
    predictor = build_predictor(
        [
            [0.9948, 0.0001, 0.0051],
            [0.1924, 0.1203, 0.6873],
            [0.1924, 0.1203, 0.6873],
        ]
    )

    result = predictor.predict("I am recovering well and I feel positive about my future.")

    assert result.calibration.applied is True
    assert result.prediction == "Mild"
    assert result.probabilities["mild"] > result.probabilities["severe"]


def test_plain_distress_text_is_not_softened():
    predictor = build_predictor(
        [
            [0.0413, 0.0325, 0.9261],
            [0.0413, 0.0325, 0.9261],
            [0.0413, 0.0325, 0.9261],
        ]
    )

    result = predictor.predict("I feel emotionally numb and cannot find joy anymore.")

    assert result.calibration.applied is False
    assert result.prediction == "Severe"
