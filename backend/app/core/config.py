from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "DepreXAI API"
    environment: str = "development"
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    prefer_gpu: bool = False
    strict_model_count: bool = False
    batch_size: int = 128
    max_length: int = 128
    lime_features: int = 8
    lime_num_samples: int = 32
    prediction_cache_size: int = 512
    dashboard_default_limit: int = 2000
    dashboard_max_limit: int = 50000
    stats_cache_ttl_seconds: int = 900
    processing_profile: Literal["fast", "balanced", "full"] = "balanced"
    kaggle_dataset_slug: str | None = None
    public_dataset_url: str = (
        "https://raw.githubusercontent.com/Bhuvanaa28/"
        "Sentiment-Analysis-for-Depression-Detection/main/processed_tweets.csv"
    )
    request_timeout_seconds: float = 45.0

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value):
        if isinstance(value, list):
            return value

        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return []

            if normalized == "*":
                return ["*"]

            if normalized.startswith("["):
                try:
                    parsed = json.loads(normalized)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass

            return [item.strip() for item in normalized.split(",") if item.strip()]

        return value

    @property
    def backend_dir(self) -> Path:
        return PROJECT_ROOT / "backend"

    @property
    def models_dir(self) -> Path:
        return PROJECT_ROOT / "models"

    @property
    def data_dir(self) -> Path:
        return PROJECT_ROOT / "data"

    @property
    def source_data_dir(self) -> Path:
        return self.data_dir / "source"

    @property
    def processed_data_dir(self) -> Path:
        return self.data_dir / "processed"

    @property
    def processed_cache_dir(self) -> Path:
        return self.processed_data_dir / "cache"

    @property
    def model_manifest_path(self) -> Path:
        return self.models_dir / "manifest.json"

    @property
    def extracted_models_dir(self) -> Path:
        return self.models_dir / ".cache"

    @property
    def source_dataset_path(self) -> Path:
        return self.source_data_dir / "depression_dataset.csv"

    @property
    def processed_dataset_path(self) -> Path:
        return self.processed_data_dir / "regional_predictions.csv"

    @property
    def latest_processing_manifest_path(self) -> Path:
        return self.processed_data_dir / "latest_process.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
