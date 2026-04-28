from backend.app.core.config import get_settings
from backend.app.services.dataset_service import DatasetService


class DummyPredictor:
    pass


def test_zone_logic_prefers_red():
    service = DatasetService(settings=get_settings(), predictor=DummyPredictor())
    assert service._resolve_zone(severe_share=60, moderate_share=20, mild_share=20) == "Red"
