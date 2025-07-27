from aws_lambda import handler


def test_lambda_success():
    """Test Lambda handler with valid input."""
    event = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000000,  # 1 million requests,
        "request_unit": "per day",
        "duration_of_each_request_in_ms": 100,  # 100 ms per request
        "memory": 512,  # 512 MB
        "memory_unit": "MB",
        "ephemeral_storage": 10,  # 10 GB of ephemeral storage
        "storage_unit": "GB",
    }
    response = handler(event, None)

    assert response["status"] == "success"
    assert isinstance(response["cost"], float)


def test_lambda_missing_duration():
    """Test Lambda handler when required field is missing."""
    event = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000000,  # 1 million requests
        "request_unit": "per day",
        # Missing "duration_of_each_request_in_ms"
        "memory": 512,  # 512 MB
        "memory_unit": "MB",
        "ephemeral_storage": 10,  # 10 GB of ephemeral storage
        "storage_unit": "GB",
    }
    response = handler(event, None)

    assert response["status"] == "error"
    assert "Missing required field: 'duration_ms'" in response["message"]


def test_lambda_default_values():
    """Test Lambda handler with missing optional field (simulate error)."""
    event = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000000,  # 1 million requests
        "request_unit": "per day",
        # Missing "duration_of_each_request_in_ms"
        "memory": 512,  # 512 MB
        "memory_unit": "MB",
        "ephemeral_storage": 10,  # 10 GB of ephemeral storage
        # Missing "storage_unit"
    }
    response = handler(event, None)

    assert response["status"] == "error"
    assert "Missing required field: 'storage_unit'" in response["message"]
