from app.main import app


def test_application_instance():
    """Verify FastAPI application instance initialization."""
    assert app.title == "InsightFlow AI"
    assert app.version == "0.1.0"


def test_openapi_schema_endpoint(client):
    """Verify OpenAPI documentation endpoints are generated correctly."""
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "InsightFlow AI"
    assert "/api/health" in data["paths"]
    assert "/api/v1/health" in data["paths"]
    assert "/api/v1/datasets" in data["paths"]
