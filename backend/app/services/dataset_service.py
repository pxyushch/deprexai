from __future__ import annotations

import hashlib
import json
import logging
import threading
from datetime import UTC, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import httpx
import pandas as pd

from ..core.config import Settings
from ..core.constants import REGIONS
from .prediction_service import EnsemblePredictor


logger = logging.getLogger(__name__)

TEXT_COLUMNS = [
    "tweet_text",
    "text",
    "tweet",
    "clean_text",
    "processed_text",
    "message",
    "content",
]
LABEL_COLUMNS = ["label", "severity", "class", "sentiment", "target"]
ZONE_PRIORITY = {"Red": 3, "Orange": 2, "Yellow": 1, "Green": 0}


class DatasetService:
    def __init__(self, settings: Settings, predictor: EnsemblePredictor) -> None:
        self.settings = settings
        self.predictor = predictor
        self._lock = threading.Lock()
        self.settings.source_data_dir.mkdir(parents=True, exist_ok=True)
        self.settings.processed_data_dir.mkdir(parents=True, exist_ok=True)
        self.settings.processed_cache_dir.mkdir(parents=True, exist_ok=True)

    def load_dataset(self) -> dict[str, Any]:
        if self.settings.source_dataset_path.exists():
            frame = pd.read_csv(self.settings.source_dataset_path)
            return {
                "status": "already_available",
                "source": str(self.settings.source_dataset_path),
                "path": str(self.settings.source_dataset_path),
                "rows": int(len(frame)),
                "columns": frame.columns.astype(str).tolist(),
                "cached": True,
            }

        if self.settings.kaggle_dataset_slug:
            try:
                path = self._download_from_kaggle(self.settings.kaggle_dataset_slug)
                frame = self._read_and_normalize(path)
                return {
                    "status": "downloaded",
                    "source": f"kaggle:{self.settings.kaggle_dataset_slug}",
                    "path": str(self.settings.source_dataset_path),
                    "rows": int(len(frame)),
                    "columns": frame.columns.astype(str).tolist(),
                    "cached": False,
                }
            except Exception:
                logger.exception("Kaggle download failed, falling back to public URL.")

        path = self._download_from_public_url(self.settings.public_dataset_url)
        frame = self._read_and_normalize(path)
        return {
            "status": "downloaded",
            "source": self.settings.public_dataset_url,
            "path": str(self.settings.source_dataset_path),
            "rows": int(len(frame)),
            "columns": frame.columns.astype(str).tolist(),
            "cached": False,
        }

    def process_dataset(self, limit: int | None = None) -> dict[str, Any]:
        with self._lock:
            if not self.settings.source_dataset_path.exists():
                self.load_dataset()

            source_frame = pd.read_csv(self.settings.source_dataset_path)
            effective_limit = (
                int(limit)
                if limit is not None
                else self.settings.dashboard_default_limit
            )
            frame = source_frame.head(effective_limit).copy() if effective_limit else source_frame.copy()
            cache_key = self._build_cache_key(
                limit=effective_limit,
                source_path=self.settings.source_dataset_path,
            )
            cache_paths = self._cache_paths(cache_key)
            cached_metadata = self._load_json(cache_paths["metadata"])

            if cache_paths["processed"].exists() and cache_paths["stats"].exists() and cached_metadata:
                logger.info(
                    "Using cached dataset processing result for limit=%s (%s).",
                    effective_limit,
                    cache_key,
                )
                latest_manifest = self._build_latest_manifest(
                    cache_key=cache_key,
                    cache_paths=cache_paths,
                    metadata=cached_metadata,
                    cached=True,
                )
                self._write_json(self.settings.latest_processing_manifest_path, latest_manifest)
                return {
                    "status": "processed",
                    "output_path": str(cache_paths["processed"]),
                    "stats_path": str(cache_paths["stats"]),
                    "rows_processed": int(cached_metadata["rows_processed"]),
                    "regions": {
                        region: int(count)
                        for region, count in cached_metadata.get("regions", {}).items()
                    },
                    "limit": cached_metadata.get("limit"),
                    "cached": True,
                    "generated_at": cached_metadata["generated_at"],
                    "processing_profile": self.settings.processing_profile,
                }

            logger.info(
                "Processing dataset rows=%s limit=%s batch_size=%s profile=%s",
                len(frame),
                effective_limit,
                self.settings.batch_size,
                self.settings.processing_profile,
            )
            texts = frame["tweet_text"].fillna("").astype(str).tolist()
            probabilities: list[list[float]] = []
            predictions: list[int] = []
            confidence_scores: list[float] = []

            for start in range(0, len(texts), self.settings.batch_size):
                batch = texts[start : start + self.settings.batch_size]
                batch_result = self.predictor.predict_batch(batch)
                batch_probs = batch_result.probabilities
                probabilities.extend(batch_probs.tolist())
                batch_indices = batch_probs.argmax(axis=1)
                predictions.extend(batch_indices.tolist())
                confidence_scores.extend(batch_probs.max(axis=1).tolist())

            processed = frame.copy()
            processed["predicted_label"] = [self._index_to_label(index) for index in predictions]
            processed["confidence"] = confidence_scores
            processed["region"] = [self._assign_region(text, idx) for idx, text in enumerate(texts)]

            for label_index, label in enumerate(("mild", "moderate", "severe")):
                processed[f"prob_{label}"] = [row[label_index] for row in probabilities]

            generated_at = self._timestamp()
            stats_payload = self._build_stats_payload(
                frame=processed,
                generated_at=generated_at,
                limit=effective_limit,
                processed_path=cache_paths["processed"],
                stats_path=cache_paths["stats"],
                cached=False,
            )
            region_counts = {
                region: int(payload["total"])
                for region, payload in stats_payload["regions"].items()
                if payload["total"] > 0
            }

            cache_paths["processed"].parent.mkdir(parents=True, exist_ok=True)
            processed.to_csv(cache_paths["processed"], index=False)
            processed.to_csv(self.settings.processed_dataset_path, index=False)
            self._write_json(cache_paths["stats"], stats_payload)

            metadata = {
                "limit": effective_limit,
                "generated_at": generated_at,
                "rows_processed": int(len(processed)),
                "regions": region_counts,
                "processing_profile": self.settings.processing_profile,
            }
            self._write_json(cache_paths["metadata"], metadata)
            latest_manifest = self._build_latest_manifest(
                cache_key=cache_key,
                cache_paths=cache_paths,
                metadata=metadata,
                cached=False,
            )
            self._write_json(self.settings.latest_processing_manifest_path, latest_manifest)

            return {
                "status": "processed",
                "output_path": str(cache_paths["processed"]),
                "stats_path": str(cache_paths["stats"]),
                "rows_processed": int(len(processed)),
                "regions": region_counts,
                "limit": effective_limit,
                "cached": False,
                "generated_at": generated_at,
                "processing_profile": self.settings.processing_profile,
            }

    def stats(self) -> dict[str, Any]:
        cached_payload = self._read_latest_stats_payload()
        if cached_payload:
            return cached_payload

        if self._lock.locked():
            logger.info(
                "Dataset processing is still running and no completed stats snapshot is available yet."
            )
            return self._empty_stats_payload()

        with self._lock:
            cached_payload = self._read_latest_stats_payload()
            if cached_payload:
                return cached_payload

            if self.settings.processed_dataset_path.exists():
                logger.info(
                    "Latest processing manifest missing. Rebuilding stats from %s.",
                    self.settings.processed_dataset_path,
                )
                frame = pd.read_csv(self.settings.processed_dataset_path)
                return self._build_stats_payload(
                    frame=frame,
                    generated_at=self._timestamp(),
                    limit=None,
                    processed_path=self.settings.processed_dataset_path,
                    stats_path=None,
                    cached=True,
                )

            logger.info(
                "Processed dataset not found at %s. Returning empty dashboard stats.",
                self.settings.processed_dataset_path,
            )
            return self._empty_stats_payload()

    def _download_from_kaggle(self, dataset_slug: str) -> Path:
        from kaggle.api.kaggle_api_extended import KaggleApi

        kaggle_dir = self.settings.source_data_dir / "kaggle"
        kaggle_dir.mkdir(parents=True, exist_ok=True)
        api = KaggleApi()
        api.authenticate()
        api.dataset_download_files(
            dataset_slug,
            path=str(kaggle_dir),
            unzip=True,
            quiet=False,
        )
        csv_files = list(kaggle_dir.rglob("*.csv"))
        if not csv_files:
            raise FileNotFoundError("No CSV file found in downloaded Kaggle dataset.")
        return csv_files[0]

    def _download_from_public_url(self, url: str) -> Path:
        destination = self.settings.source_data_dir / Path(url).name
        with httpx.Client(
            timeout=self.settings.request_timeout_seconds,
            follow_redirects=True,
        ) as client:
            response = client.get(url)
            response.raise_for_status()
            destination.write_bytes(response.content)
        return destination

    def _read_and_normalize(self, source_path: Path) -> pd.DataFrame:
        frame = pd.read_csv(source_path)
        normalized = self._normalize_columns(frame)
        normalized.to_csv(self.settings.source_dataset_path, index=False)
        if source_path.resolve() != self.settings.source_dataset_path.resolve():
            try:
                source_path.unlink(missing_ok=True)
            except OSError:
                logger.debug("Leaving downloaded source file in place: %s", source_path)
        return normalized

    def _normalize_columns(self, frame: pd.DataFrame) -> pd.DataFrame:
        text_column = next((column for column in frame.columns if column in TEXT_COLUMNS), None)
        if text_column is None:
            text_column = frame.columns[0]

        normalized = frame.rename(columns={text_column: "tweet_text"}).copy()
        if "label" not in normalized.columns:
            candidate = next((column for column in normalized.columns if column in LABEL_COLUMNS), None)
            if candidate:
                normalized = normalized.rename(columns={candidate: "label"})
            else:
                normalized["label"] = "Unknown"

        normalized["tweet_text"] = normalized["tweet_text"].fillna("").astype(str)
        normalized = normalized[normalized["tweet_text"].str.len() > 0].drop_duplicates(
            subset=["tweet_text"]
        )
        return normalized.reset_index(drop=True)

    def _build_cache_key(self, limit: int | None, source_path: Path) -> str:
        self.predictor.warmup()
        source_stat = source_path.stat()
        model_signature = "|".join(self.predictor.model_names) or "unloaded-models"
        payload = (
            f"{source_path.resolve()}|{source_stat.st_size}|{source_stat.st_mtime_ns}|"
            f"{limit}|{self.settings.batch_size}|{self.settings.processing_profile}|"
            f"{model_signature}"
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

    def _cache_paths(self, cache_key: str) -> dict[str, Path]:
        cache_root = self.settings.processed_cache_dir
        return {
            "processed": cache_root / f"regional_predictions.{cache_key}.csv",
            "stats": cache_root / f"regional_stats.{cache_key}.json",
            "metadata": cache_root / f"regional_meta.{cache_key}.json",
        }

    def _build_stats_payload(
        self,
        frame: pd.DataFrame,
        generated_at: str,
        limit: int | None,
        processed_path: Path | None,
        stats_path: Path | None,
        cached: bool,
    ) -> dict[str, Any]:
        regions: dict[str, Any] = {}
        total_posts = 0
        total_severe = 0
        total_confidence = 0.0
        highest_alert_region: str | None = None
        highest_alert_zone: str | None = None
        highest_alert_score = -1.0

        for region in REGIONS:
            region_frame = frame[frame["region"] == region]
            counts = region_frame["predicted_label"].value_counts().to_dict()
            mild = int(counts.get("Mild", 0))
            moderate = int(counts.get("Moderate", 0))
            severe = int(counts.get("Severe", 0))
            total = mild + moderate + severe
            severe_share = float((severe / total * 100) if total else 0.0)
            moderate_share = float((moderate / total * 100) if total else 0.0)
            mild_share = float((mild / total * 100) if total else 0.0)
            average_confidence = float(
                round(region_frame["confidence"].mean(), 4)
            ) if total else 0.0
            zone = self._resolve_zone(
                severe_share=severe_share,
                moderate_share=moderate_share,
                mild_share=mild_share,
            )
            regions[region] = {
                "mild": mild,
                "moderate": moderate,
                "severe": severe,
                "zone": zone,
                "total": total,
                "severe_share": round(severe_share, 2),
                "average_confidence": average_confidence,
            }

            total_posts += total
            total_severe += severe
            total_confidence += float(region_frame["confidence"].sum()) if total else 0.0
            alert_score = ZONE_PRIORITY[zone] * 100 + severe_share
            if total and alert_score > highest_alert_score:
                highest_alert_score = alert_score
                highest_alert_region = region
                highest_alert_zone = zone

        overall_confidence = round(total_confidence / total_posts, 4) if total_posts else 0.0
        overall_severe_share = round((total_severe / total_posts) * 100, 2) if total_posts else 0.0
        return {
            "regions": regions,
            "summary": {
                "total_posts": total_posts,
                "average_confidence": overall_confidence,
                "highest_alert_region": highest_alert_region,
                "highest_alert_zone": highest_alert_zone,
                "severe_share": overall_severe_share,
            },
            "meta": {
                "status": "ready",
                "cached": cached,
                "generated_at": generated_at,
                "limit": limit,
                "source_path": str(self.settings.source_dataset_path),
                "processed_path": str(processed_path) if processed_path else None,
                "stats_path": str(stats_path) if stats_path else None,
                "processing_profile": self.settings.processing_profile,
            },
        }

    def _empty_stats_payload(self) -> dict[str, Any]:
        return {
            "regions": {},
            "summary": {
                "total_posts": 0,
                "average_confidence": 0.0,
                "highest_alert_region": None,
                "highest_alert_zone": None,
                "severe_share": 0.0,
            },
            "meta": {
                "status": "empty",
                "cached": False,
                "generated_at": None,
                "limit": None,
                "source_path": str(self.settings.source_dataset_path),
                "processed_path": None,
                "stats_path": None,
                "processing_profile": self.settings.processing_profile,
            },
        }

    def _build_latest_manifest(
        self,
        cache_key: str,
        cache_paths: dict[str, Path],
        metadata: dict[str, Any],
        cached: bool,
    ) -> dict[str, Any]:
        return {
            "cache_key": cache_key,
            "source_path": str(self.settings.source_dataset_path),
            "processed_path": str(cache_paths["processed"]),
            "stats_path": str(cache_paths["stats"]),
            "limit": metadata.get("limit"),
            "rows_processed": metadata.get("rows_processed", 0),
            "regions": metadata.get("regions", {}),
            "generated_at": metadata.get("generated_at"),
            "processing_profile": metadata.get(
                "processing_profile", self.settings.processing_profile
            ),
            "cached": cached,
        }

    def _read_latest_stats_payload(self) -> dict[str, Any] | None:
        latest_manifest = self._load_json(self.settings.latest_processing_manifest_path)
        stats_path_value = latest_manifest.get("stats_path")
        if not stats_path_value:
            return None

        stats_path = Path(stats_path_value)
        if not stats_path.exists():
            return None

        payload = self._load_json(stats_path)
        if not payload:
            return None

        payload.setdefault("meta", {})
        payload["meta"]["cached"] = True
        return payload

    def _load_json(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_json(self, path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            suffix=".tmp",
            delete=False,
        ) as handle:
            json.dump(payload, handle, indent=2)
            temp_path = Path(handle.name)
        temp_path.replace(path)

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()

    def _assign_region(self, text: str, index: int) -> str:
        digest = hashlib.sha256(f"{index}:{text}".encode("utf-8")).digest()[0]
        return REGIONS[digest % len(REGIONS)]

    def _index_to_label(self, index: int) -> str:
        return ["Mild", "Moderate", "Severe"][index]

    def _resolve_zone(self, severe_share: float, moderate_share: float, mild_share: float) -> str:
        if severe_share > 50:
            return "Red"
        if 30 <= severe_share <= 50:
            return "Orange"
        if moderate_share >= max(severe_share, mild_share):
            return "Yellow"
        return "Green"
