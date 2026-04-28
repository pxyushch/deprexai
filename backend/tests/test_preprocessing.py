from backend.app.services.preprocessing import clean_text


def test_clean_text_matches_training_shape():
    raw_text = "I feel HOPELESS... Visit https://example.com #depression @user"
    assert clean_text(raw_text) == "i feel hopeless visit"
