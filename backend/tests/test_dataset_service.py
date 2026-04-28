import json
from pathlib import Path

from backend.app.services.dataset_service import DatasetService


class DummyPredictor:
    model_names = ["dummy-model"]

    def warmup(self) -> None:
        return None


class FakeSettings:
    def __init__(self, root: Path) -> None:
        self.source_data_dir = root / "source"
        self.processed_data_dir = root / "processed"
        self.processed_cache_dir = self.processed_data_dir / "cache"
        self.source_data_dir.mkdir(parents=True, exist_ok=True)
        self.processed_data_dir.mkdir(parents=True, exist_ok=True)
        self.processed_cache_dir.mkdir(parents=True, exist_ok=True)
        self.source_dataset_path = self.source_data_dir / "depression_dataset.csv"
        self.processed_dataset_path = self.processed_data_dir / "regional_predictions.csv"
        self.latest_processing_manifest_path = self.processed_data_dir / "latest_process.json"
        self.kaggle_dataset_slug = None
        self.public_dataset_url = "https://example.com/dataset.csv"
        self.request_timeout_seconds = 5
        self.batch_size = 16
        self.dashboard_default_limit = 2000
        self.processing_profile = "balanced"


def test_stats_returns_empty_until_data_is_processed(tmp_path: Path):
    settings = FakeSettings(tmp_path)
    service = DatasetService(settings=settings, predictor=DummyPredictor())

    assert service.stats()["meta"]["status"] == "empty"
    assert service.stats()["summary"]["total_posts"] == 0


def test_stats_returns_cached_snapshot_while_processing_lock_is_held(tmp_path: Path):
    settings = FakeSettings(tmp_path)
    service = DatasetService(settings=settings, predictor=DummyPredictor())

    stats_path = settings.processed_cache_dir / "regional_stats.cached.json"
    stats_path.write_text(
        """
{
  "regions": {
    "India": {
      "mild": 10,
      "moderate": 5,
      "severe": 2,
      "zone": "Yellow",
      "total": 17,
      "severe_share": 11.76,
      "average_confidence": 0.82
    }
  },
  "summary": {
    "total_posts": 17,
    "average_confidence": 0.82,
    "highest_alert_region": "India",
    "highest_alert_zone": "Yellow",
    "severe_share": 11.76
  },
  "meta": {
    "status": "ready",
    "cached": false,
    "generated_at": "2026-04-25T00:00:00+00:00",
    "limit": 2000,
    "source_path": null,
    "processed_path": null,
    "stats_path": null,
    "processing_profile": "balanced"
  }
}
        """.strip(),
        encoding="utf-8",
    )
    settings.latest_processing_manifest_path.write_text(
        json.dumps({"stats_path": str(stats_path), "limit": 2000}),
        encoding="utf-8",
    )

    service._lock.acquire()
    try:
        payload = service.stats()
    finally:
        service._lock.release()

    assert payload["summary"]["total_posts"] == 17
    assert payload["meta"]["cached"] is True
