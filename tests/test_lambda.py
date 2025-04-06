from aws_lambda import handler


def test_lambda_success():
    """Test Lambda handler with valid input."""
    event = {
        "duration_ms": 100,
        "requests_millions": 2,
        "concurrency": 5,
        "ram_gb": 0.5,
    }
    response = handler(event, None)

    assert response["status"] == "success"
    assert isinstance(response["cost"], float)


def test_lambda_missing_duration():
    """Test Lambda handler when required field is missing."""
    event = {
        # Missing "duration_ms"
        "requests_millions": 2,
        "concurrency": 5,
        "ram_gb": 0.5,
    }
    response = handler(event, None)

    assert response["status"] == "error"
    assert "Missing required field: 'duration_ms'" in response["message"]


def test_lambda_default_values():
    """Test Lambda handler with missing optional field (simulate error)."""
    event = {
        "duration_ms": 100,
        # Missing "requests_millions"
        "concurrency": 5,
        "ram_gb": 0.5,
    }
    response = handler(event, None)

    assert response["status"] == "error"
    assert "Missing required field: 'requests_millions'" in response["message"]
