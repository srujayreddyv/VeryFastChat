"""Tests for health and metrics endpoints."""


def test_health_check(client):
    """Test health endpoint returns status with checks."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "checks" in data
    assert data["checks"]["api"] == "ok"


def test_metrics_without_secret(client, monkeypatch):
    """Test metrics endpoint without secret (when not configured)."""
    monkeypatch.setattr("app.config.settings.metrics_secret", "")
    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "counts" in data


def test_metrics_with_valid_secret(client, monkeypatch):
    """Test metrics endpoint with valid secret."""
    monkeypatch.setattr("app.config.settings.metrics_secret", "test-secret")
    response = client.get("/metrics", headers={"X-Metrics-Secret": "test-secret"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_metrics_with_invalid_secret(client, monkeypatch):
    """Test metrics endpoint with invalid secret."""
    monkeypatch.setattr("app.config.settings.metrics_secret", "test-secret")
    response = client.get("/metrics", headers={"X-Metrics-Secret": "wrong-secret"})
    assert response.status_code == 401
