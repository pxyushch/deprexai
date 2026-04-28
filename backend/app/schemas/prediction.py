from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

from ..services.preprocessing import clean_text

MEANINGFUL_WORD_PATTERN = re.compile(r"[a-z]{2,}")


class PredictRequest(BaseModel):
    text: str = Field(..., max_length=5000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 3:
            raise PydanticCustomError("invalid_prompt", "Enter a valid prompt.")

        cleaned = clean_text(trimmed)
        if len(cleaned) < 2 or not MEANINGFUL_WORD_PATTERN.search(cleaned):
            raise PydanticCustomError("invalid_prompt", "Enter a valid prompt.")
        return trimmed


class ModelArtifact(BaseModel):
    alias: str
    display_name: str
    loader: str
    source: str
    resolved_source: str
    model_type: str
    device: str
    class_labels: list[str]


class ExplanationToken(BaseModel):
    token: str
    weight: float
    normalized_weight: float
    magnitude: float
    direction: Literal["supports", "opposes"]
    rank: int


class ExplanationResponse(BaseModel):
    tokens: list[ExplanationToken]
    supporting: list[ExplanationToken]
    opposing: list[ExplanationToken]
    max_abs_weight: float


class CalibrationResponse(BaseModel):
    applied: bool
    strategy: str | None = None
    reason: str | None = None
    raw_prediction: str
    raw_confidence: float


class PredictionMeta(BaseModel):
    cleaned_text: str
    input_characters: int
    cleaned_characters: int
    input_words: int
    cleaned_words: int
    inference_ms: float
    explanation_ms: float
    total_ms: float
    cached: bool
    models_used: list[str]
    calibration: CalibrationResponse


class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    explanation: ExplanationResponse
    meta: PredictionMeta


class HealthResponse(BaseModel):
    status: str
    loaded_models: list[str]
    artifacts: list[ModelArtifact]
