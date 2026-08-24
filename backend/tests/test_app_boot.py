def test_app_imports():
    """All API modules must import cleanly or the server cannot start."""
    from app.main import app

    assert app.title
