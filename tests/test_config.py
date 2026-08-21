def test_config_loading(app_settings):
    """Test environment configuration values load properly."""
    assert app_settings.PROJECT_NAME == "InsightFlow AI"
    assert app_settings.VERSION is not None
    assert isinstance(app_settings.BACKEND_CORS_ORIGINS, list)
    assert len(app_settings.BACKEND_CORS_ORIGINS) > 0
    assert "postgresql" in app_settings.DATABASE_URL
