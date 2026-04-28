import pytest
from pydantic import ValidationError

from backend.app.schemas.prediction import PredictRequest


@pytest.mark.parametrize(
    "text",
    [
        "!!! @someone https://example.com",
        "123456",
        "$$$ 123 ###",
        "😂😂😂",
        "@@@ ### !!!",
    ],
)
def test_predict_request_rejects_non_meaningful_prompts(text: str):
    with pytest.raises(ValidationError):
        PredictRequest(text=text)


def test_predict_request_trims_valid_input():
    payload = PredictRequest(text="   I feel exhausted and disconnected.   ")
    assert payload.text == "I feel exhausted and disconnected."


def test_predict_request_accepts_words_mixed_with_numbers():
    payload = PredictRequest(text="123 happy 456")
    assert payload.text == "123 happy 456"
