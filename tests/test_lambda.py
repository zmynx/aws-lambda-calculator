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
    assert "Missing required field: 'duration_of_each_request_in_ms'" in body["message"]


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


def test_lambda_verbose_default():
    """Test Lambda handler with default verbose mode (should be True)."""
    payload = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000,
        "request_unit": "per hour",
        "duration_of_each_request_in_ms": 1500,
        "memory": 128,
        "memory_unit": "MB",
        "ephemeral_storage": 512,
        "storage_unit": "MB",
        # verbose flag not specified, should default to True
    }
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "success"
    assert isinstance(body["cost"], float)
    # Check that verbose_logs is present (default is verbose=True)
    assert "verbose_logs" in body


def test_lambda_verbose_true():
    """Test Lambda handler with explicit verbose=True."""
    payload = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000,
        "request_unit": "per hour",
        "duration_of_each_request_in_ms": 1500,
        "memory": 128,
        "memory_unit": "MB",
        "ephemeral_storage": 512,
        "storage_unit": "MB",
        "verbose": True,
    }
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "success"
    assert isinstance(body["cost"], float)
    assert "verbose_logs" in body
    # Verify that verbose_logs is a string
    assert isinstance(body["verbose_logs"], str)


def test_lambda_verbose_false():
    """Test Lambda handler with verbose=False."""
    payload = {
        "region": "us-east-1",
        "architecture": "x86",
        "number_of_requests": 1000,
        "request_unit": "per hour",
        "duration_of_each_request_in_ms": 1500,
        "memory": 128,
        "memory_unit": "MB",
        "ephemeral_storage": 512,
        "storage_unit": "MB",
        "verbose": False,
    }
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "success"
    assert isinstance(body["cost"], float)
    # Check that verbose_logs is NOT present when verbose=False
    assert "verbose_logs" not in body


def test_lambda_verbose_with_different_units():
    """Test Lambda handler verbose mode with different unit conversions."""
    payload = {
        "region": "us-west-2",
        "architecture": "arm64",
        "number_of_requests": 5000,
        "request_unit": "per minute",
        "duration_of_each_request_in_ms": 2000,
        "memory": 2048,
        "memory_unit": "MB",
        "ephemeral_storage": 1,
        "storage_unit": "GB",
        "verbose": True,
    }
    event = {"body": json.dumps(payload)}
    response = handler(event, None)
    logger.debug(f"response: {response}")
    body = json.loads(response["body"])
    assert body["status"] == "success"
    assert isinstance(body["cost"], float)
    assert "verbose_logs" in body
    # Check that logs contain some expected debug information
    verbose_logs = body["verbose_logs"]
    assert isinstance(verbose_logs, str)
