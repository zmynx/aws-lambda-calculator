from aws_lambda import handler
import json
import logging

logger = logging.getLogger(__name__)


def test_lambda_success():
    """Test Lambda handler with valid input."""
    payload = {
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
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "success"
    assert isinstance(body["cost"], float)


def test_lambda_missing_duration():
    """Test Lambda handler when required field is missing."""
    payload = {
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
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "error"
    assert (
        "Missing required field: 'duration_of_each_request_in_ms'"
        in body["message"]
    )


def test_lambda_missing_storage_unit():
    """Test Lambda handler with missing optional field (simulate error)."""
    payload = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000000,  # 1 million requests
        "request_unit": "per day",
        "duration_of_each_request_in_ms": 100,  # 100 ms per request
        "memory": 512,  # 512 MB
        "memory_unit": "MB",
        "ephemeral_storage": 10,  # 10 GB of ephemeral storage
        # Missing "storage_unit"
    }
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "error"
    assert "Missing required field: 'storage_unit'" in body["message"]
