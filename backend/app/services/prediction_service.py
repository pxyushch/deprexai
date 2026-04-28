from __future__ import annotations

import logging
import re
from collections import OrderedDict
from dataclasses import dataclass

import numpy as np

from ..core.constants import CANONICAL_LABELS, LABEL_TO_KEY
from .preprocessing import batch_clean_text
from .model_loader import ModelLoadError, ModelRegistry


logger = logging.getLogger(__name__)

TOKEN_PATTERN = re.compile(r"[a-z]+")
NEGATED_DISTRESS_PATTERN = re.compile(
    r"\b(?:not|no longer)\s+(?:feel\s+)?"
    r"(?:depressed|hopeless|suicidal|anxious|sad|empty|worthless|miserable)\b"
)
NEGATED_POSITIVE_PATTERN = re.compile(
    r"\b(?:not|no longer|dont|never)\s+(?:(?:feel|feeling|doing)\s+)?"
    r"(?:better|calm|enjoying|good|grateful|great|happy|hopeful|joyful|peaceful|positive|safe|stable|well)\b"
)
RECOVERY_PATTERN = re.compile(
    r"\b(?:used to\b.*\bbut now|"
    r"recovering(?: well)?|"
    r"getting better|"
    r"better now|"
    r"enjoying life again|"
    r"feeling better|"
    r"doing better)\b"
)
POSITIVE_STATE_PATTERN = re.compile(
    r"\b(?:doing well|"
    r"feeling (?:good|great|happy|hopeful|positive|safe|stable)|"
    r"feel (?:good|great|happy|hopeful|positive|safe|stable)|"
    r"enjoying(?: life)?|"
    r"grateful|"
    r"joyful|"
    r"peaceful|"
    r"optimistic|"
    r"content)\b"
)
POSITIVE_OUTLOOK_TERMS = {
    "begin",
    "beginning",
    "forward",
    "future",
    "grow",
    "growing",
    "start",
    "starting",
    "tomorrow",
}
POSITIVE_TERMS = {
    "better",
    "calm",
    "content",
    "enjoying",
    "excited",
    "good",
    "grateful",
    "great",
    "happy",
    "hopeful",
    "joyful",
    "optimistic",
    "peaceful",
    "positive",
    "recovering",
    "safe",
    "stable",
    "strong",
    "supported",
    "well",
}
DISTRESS_TERMS = {
    "anxiety",
    "anxious",
    "dead",
    "depressed",
    "die",
    "dying",
    "empty",
    "exhausted",
    "hopeless",
    "miserable",
    "numb",
    "sad",
    "selfharm",
    "suicide",
    "suicidal",
    "worthless",
}


@dataclass
class CalibrationMetadata:
    applied: bool
    strategy: str | None
    reason: str | None
    raw_prediction: str
    raw_confidence: float


@dataclass
class PredictionResult:
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    cleaned_text: str
    cached: bool
    calibration: CalibrationMetadata


@dataclass
class BatchPredictionResult:
    probabilities: np.ndarray
    cleaned_texts: list[str]
    cache_hits: int


def _normalize_probabilities(vector: np.ndarray) -> np.ndarray:
    normalized = np.array(vector, dtype=np.float32)
    total = float(normalized.sum())
    if total <= 0:
        return np.full(len(CANONICAL_LABELS), 1 / len(CANONICAL_LABELS), dtype=np.float32)
    return normalized / total


def _calibrate_probabilities(
    cleaned_text: str,
    probabilities: np.ndarray,
) -> tuple[np.ndarray, CalibrationMetadata]:
    raw_probabilities = _normalize_probabilities(probabilities)
    raw_prediction_index = int(np.argmax(raw_probabilities))
    raw_prediction = CANONICAL_LABELS[raw_prediction_index]
    raw_confidence = float(raw_probabilities[raw_prediction_index])

    tokens = set(TOKEN_PATTERN.findall(cleaned_text.lower()))
    token_count = len(tokens)
    positive_hits = len(tokens & POSITIVE_TERMS)
    outlook_hits = len(tokens & POSITIVE_OUTLOOK_TERMS)
    distress_hits = len(tokens & DISTRESS_TERMS)
    has_negated_distress = bool(NEGATED_DISTRESS_PATTERN.search(cleaned_text))
    has_negated_positive = bool(NEGATED_POSITIVE_PATTERN.search(cleaned_text))
    has_recovery_pattern = bool(RECOVERY_PATTERN.search(cleaned_text))
    has_positive_state_pattern = bool(POSITIVE_STATE_PATTERN.search(cleaned_text))
    has_recovery_language = has_negated_distress or has_recovery_pattern

    mild_index = CANONICAL_LABELS.index("Mild")
    severe_index = CANONICAL_LABELS.index("Severe")
    severe_close_to_mild = (
        raw_probabilities[severe_index] >= raw_probabilities[mild_index] - 0.08
    )

    strategy: str | None = None
    reason: str | None = None
    weight = 0.0
    target = raw_probabilities

    if (
        raw_prediction == "Severe"
        and token_count <= 5
        and positive_hits >= 1
        and distress_hits == 0
        and not has_negated_positive
    ):
        strategy = "short_positive_override"
        reason = (
            "A short positive phrase without distress terms was detected, so the "
            "prediction was pulled away from an implausible high-severity label."
        )
        target = np.array([0.82, 0.12, 0.06], dtype=np.float32)
        weight = 0.72
    elif (
        raw_prediction == "Severe"
        and distress_hits == 0
        and not has_negated_positive
        and (
            positive_hits >= 2
            or has_positive_state_pattern
            or (positive_hits >= 1 and outlook_hits >= 1)
        )
    ):
        strategy = "positive_language_override"
        reason = (
            "Clear positive wellbeing language was detected without matching distress cues, "
            "so the severe prediction was softened for a more plausible interpretation."
        )
        target = np.array([0.88, 0.09, 0.03], dtype=np.float32)
        weight = 0.78 if raw_confidence >= 0.75 else 0.68
    elif has_recovery_language and positive_hits >= 2 and raw_prediction != "Mild":
        strategy = "recovery_override"
        reason = (
            "Recovery-oriented wording was detected, so the raw model score was "
            "rebalanced away from symptom-term overfitting."
        )
        target = np.array([0.9, 0.08, 0.02], dtype=np.float32)
        weight = 0.82
    elif has_recovery_language and positive_hits >= 2 and severe_close_to_mild:
        strategy = "recovery_tiebreak"
        reason = (
            "Positive recovery cues were detected in an ambiguous result, so the "
            "prediction was nudged toward a lower-risk interpretation."
        )
        target = np.array([0.78, 0.16, 0.06], dtype=np.float32)
        weight = 0.55
    elif has_recovery_pattern and positive_hits >= 3 and distress_hits <= 1 and raw_prediction != "Mild":
        strategy = "positive_recovery_override"
        reason = (
            "The text describes improvement or recovery more strongly than distress, "
            "so the output was softened for demo reliability."
        )
        target = np.array([0.84, 0.12, 0.04], dtype=np.float32)
        weight = 0.7

    if not strategy:
        return raw_probabilities, CalibrationMetadata(
            applied=False,
            strategy=None,
            reason=None,
            raw_prediction=raw_prediction,
            raw_confidence=raw_confidence,
        )

    calibrated = _normalize_probabilities((1 - weight) * raw_probabilities + weight * target)
    return calibrated, CalibrationMetadata(
        applied=True,
        strategy=strategy,
        reason=reason,
        raw_prediction=raw_prediction,
        raw_confidence=raw_confidence,
    )


class EnsemblePredictor:
    def __init__(
        self,
        registry: ModelRegistry,
        strict_model_count: bool = False,
        cache_size: int = 512,
    ) -> None:
        self.registry = registry
        self.strict_model_count = strict_model_count
        self.cache_size = cache_size
        self._models = []
        self._model_names: list[str] = []
        self._model_descriptions: list[dict[str, str | list[str]]] = []
        self._probability_cache: OrderedDict[str, np.ndarray] = OrderedDict()

    @property
    def model_names(self) -> list[str]:
        return self._model_names

    @property
    def model_descriptions(self) -> list[dict[str, str | list[str]]]:
        return self._model_descriptions

    @property
    def cache_entries(self) -> int:
        return len(self._probability_cache)

    def warmup(self) -> None:
        try:
            self._ensure_models_loaded()
        except ModelLoadError:
            logger.exception("Model warmup failed.")

    def predict(self, text: str) -> PredictionResult:
        batch = self.predict_batch([text])
        raw_probabilities = batch.probabilities[0]
        probabilities, calibration = _calibrate_probabilities(
            batch.cleaned_texts[0],
            raw_probabilities,
        )
        prediction_index = int(np.argmax(probabilities))
        label = CANONICAL_LABELS[prediction_index]
        confidence = float(probabilities[prediction_index])
        if calibration.applied:
            logger.info(
                "Applied %s calibration raw_prediction=%s cleaned_text=%s",
                calibration.strategy,
                calibration.raw_prediction,
                batch.cleaned_texts[0],
            )
        return PredictionResult(
            prediction=label,
            confidence=confidence,
            probabilities={
                LABEL_TO_KEY[class_name]: float(probabilities[index])
                for index, class_name in enumerate(CANONICAL_LABELS)
            },
            cleaned_text=batch.cleaned_texts[0],
            cached=batch.cache_hits > 0,
            calibration=calibration,
        )

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        return self.predict_batch(texts).probabilities

    def predict_batch(self, texts: list[str]) -> BatchPredictionResult:
        cleaned_texts = batch_clean_text(texts)
        models = self._ensure_models_loaded()
        probabilities = np.zeros((len(cleaned_texts), len(CANONICAL_LABELS)), dtype=np.float32)
        cache_hits = 0
        missing_indices: list[int] = []
        missing_texts: list[str] = []

        for index, cleaned_text in enumerate(cleaned_texts):
            cached = self._probability_cache.get(cleaned_text)
            if cached is None:
                missing_indices.append(index)
                missing_texts.append(cleaned_text)
                continue

            probabilities[index] = cached
            cache_hits += 1
            self._probability_cache.move_to_end(cleaned_text)

        if missing_texts:
            all_outputs = [model.predict_proba(missing_texts) for model in models]
            stacked = np.stack(all_outputs, axis=0)
            predicted = stacked.mean(axis=0)
            for index, cleaned_text, vector in zip(missing_indices, missing_texts, predicted):
                probabilities[index] = vector
                self._remember_probability(cleaned_text, vector)

        return BatchPredictionResult(
            probabilities=probabilities,
            cleaned_texts=cleaned_texts,
            cache_hits=cache_hits,
        )

    def clear_cache(self) -> None:
        self._probability_cache.clear()

    def _ensure_models_loaded(self):
        if self._models:
            return self._models

        self._models = self.registry.load_all()
        self._model_names = [model.display_name for model in self._models]
        self._model_descriptions = [model.describe() for model in self._models]

        if self.strict_model_count and len(self._models) != 3:
            raise ModelLoadError(
                "Expected three models (ESG, ABV, XDL) in /models, "
                f"but found {len(self._models)}."
            )
        if not self._models:
            raise ModelLoadError(
                "No compatible model files were found in /models. "
                "Place extracted HuggingFace folders or zip files there."
            )

        return self._models

    def _remember_probability(self, cleaned_text: str, vector: np.ndarray) -> None:
        self._probability_cache[cleaned_text] = np.array(vector, dtype=np.float32)
        self._probability_cache.move_to_end(cleaned_text)
        while len(self._probability_cache) > self.cache_size:
            self._probability_cache.popitem(last=False)
