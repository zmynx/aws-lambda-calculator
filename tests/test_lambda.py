import pytest
from aws_lambda import handler


def test_lambda_success():
    """Test Lambda handler with valid input."""
    event = {"name": "Alice", "age": 30, "country": "Canada"}
    response = handler(event, None)

    assert response["status"] == "success"
    assert "Hello Alice from Canada" in response["message"]


def test_lambda_missing_age():
    """Test Lambda handler when 'age' is missing."""
    event = {"name": "Bob", "country": "USA"}
    response = handler(event, None)

    assert response["status"] == "error"
    assert "Missing required field: age" in response["message"]


def test_lambda_default_values():
    """Test Lambda handler when optional fields are missing."""
    event = {"age": 25}  # No name, no country
    response = handler(event, None)

    assert response["status"] == "success"
    assert "Hello Guest from Unknown, age 25!" in response["message"]
