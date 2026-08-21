def test_top_level_health_endpoint(client):
    """Test GET /api/health endpoint structure and response code."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["project_name"] == "InsightFlow AI"
    assert "database_connected" in data
    assert "timestamp" in data


def test_v1_health_endpoint(client):
    """Test GET /api/v1/health endpoint structure and response code."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["project_name"] == "InsightFlow AI"
    assert "database_connected" in data
    assert "timestamp" in data


def test_datasets_placeholder_endpoint(client):
    """Test GET /api/v1/datasets endpoint initial empty/list response."""
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)
