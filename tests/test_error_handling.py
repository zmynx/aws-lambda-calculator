import pytest
import json
from unittest.mock import patch, MagicMock
from aws_lambda import handler
from test_cli import run_cli
from pydantic import ValidationError


class TestLambdaErrorHandling:
    """Tests for error handling in Lambda handler."""

    def test_lambda_invalid_json_body(self):
        """Test Lambda handler with invalid JSON in body."""
        event = {"body": "invalid json {"}
        response = handler(event, None)
        
        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert body["status"] == "error"
        assert "message" in body

    def test_lambda_empty_body(self):
        """Test Lambda handler with empty body."""
        event = {}  # No body key
        response = handler(event, None)
        
        assert response["statusCode"] == 400  # Missing required field is client error
        body = json.loads(response["body"])
        assert body["status"] == "error"

    def test_lambda_pydantic_validation_error(self):
        """Test Lambda handler with pydantic validation error."""
        payload = {
            "region": "us-east-1",
            "architecture": "invalid-arch",  # Invalid architecture
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            "memory": 512,
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)
        
        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert body["status"] == "error"
        assert "validation error" in body["message"].lower()

    def test_lambda_missing_region_field(self):
        """Test Lambda handler with missing region field."""
        payload = {
            # Missing "region"
            "architecture": "x86",
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            "memory": 512,
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["status"] == "error"
        assert "Missing required field: 'region'" in body["message"]

    def test_lambda_missing_architecture_field(self):
        """Test Lambda handler with missing architecture field."""
        payload = {
            "region": "us-east-1",
            # Missing "architecture"
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            "memory": 512,
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["status"] == "error"
        assert "Missing required field: 'architecture'" in body["message"]

    def test_lambda_missing_memory_field(self):
        """Test Lambda handler with missing memory field."""
        payload = {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            # Missing "memory"
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["status"] == "error"
        assert "Missing required field: 'memory'" in body["message"]

    def test_lambda_calculation_exception(self):
        """Test Lambda handler when calculation raises an exception."""
        payload = {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            "memory": 512,
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
        }
        event = {"body": json.dumps(payload)}
        
        # Mock the calculate function to raise an exception
        with patch('aws_lambda.calculate') as mock_calculate:
            mock_calculate.side_effect = Exception("Calculation error")
            response = handler(event, None)
        
        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert body["status"] == "error"
        assert "Calculation error" in body["message"]

    def test_lambda_verbose_false_no_steps(self):
        """Test Lambda handler with verbose=False doesn't include steps."""
        payload = {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            "memory": 512,
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
            "verbose": False,
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)
        
        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "success"
        assert "calculation_steps" not in body

    def test_lambda_response_headers(self):
        """Test Lambda handler response includes correct CORS headers."""
        payload = {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 1000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 100,
            "memory": 512,
            "memory_unit": "MB",
            "ephemeral_storage": 512,
            "storage_unit": "MB",
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)
        
        headers = response["headers"]
        assert headers["Access-Control-Allow-Origin"] == "*"
        assert headers["Access-Control-Allow-Headers"] == "*"
        assert headers["Access-Control-Allow-Methods"] == "OPTIONS,POST,GET"


class TestCLIErrorHandling:
    """Tests for CLI error handling paths."""

    def test_cli_pydantic_validation_error_handling(self):
        """Test CLI handles pydantic validation errors properly."""
        # Test with invalid memory value that will trigger pydantic validation
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "x86",
            "--number-of-requests", "1000",
            "--request-unit", "per hour",
            "--duration-of-each-request-in-ms", "100",
            "--memory", "50",  # Too low, will trigger validation error
            "--memory-unit", "MB",
            "--ephemeral-storage", "512",
            "--storage-unit", "MB"
        )
        
        assert exit_code == 1
        assert "validation error" in stderr.lower()

    def test_cli_invalid_memory_range(self):
        """Test CLI with memory outside valid range."""
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "x86",
            "--number-of-requests", "1000",
            "--request-unit", "per hour",
            "--duration-of-each-request-in-ms", "100",
            "--memory", "15000",  # Too high for MB
            "--memory-unit", "MB",
            "--ephemeral-storage", "512",
            "--storage-unit", "MB"
        )
        
        assert exit_code == 1
        assert "validation error" in stderr.lower()

    def test_cli_invalid_ephemeral_storage_range(self):
        """Test CLI with ephemeral storage outside valid range."""
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "x86",
            "--number-of-requests", "1000",
            "--request-unit", "per hour",
            "--duration-of-each-request-in-ms", "100",
            "--memory", "512",
            "--memory-unit", "MB",
            "--ephemeral-storage", "400",  # Too low for MB
            "--storage-unit", "MB"
        )
        
        assert exit_code == 1
        assert "validation error" in stderr.lower()

    def test_cli_zero_requests(self):
        """Test CLI with zero requests."""
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "x86",
            "--number-of-requests", "0",  # Invalid
            "--request-unit", "per hour",
            "--duration-of-each-request-in-ms", "100",
            "--memory", "512",
            "--memory-unit", "MB",
            "--ephemeral-storage", "512",
            "--storage-unit", "MB"
        )
        
        assert exit_code == 1
        assert "validation error" in stderr.lower()

    def test_cli_zero_duration(self):
        """Test CLI with zero duration."""
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "x86",
            "--number-of-requests", "1000",
            "--request-unit", "per hour",
            "--duration-of-each-request-in-ms", "0",  # Invalid
            "--memory", "512",
            "--memory-unit", "MB",
            "--ephemeral-storage", "512",
            "--storage-unit", "MB"
        )
        
        assert exit_code == 1
        assert "validation error" in stderr.lower()

    def test_cli_with_gb_units(self):
        """Test CLI with valid GB units."""
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "arm64",
            "--number-of-requests", "1000",
            "--request-unit", "per second",
            "--duration-of-each-request-in-ms", "100",
            "--memory", "1",
            "--memory-unit", "GB",
            "--ephemeral-storage", "2",
            "--storage-unit", "GB"
        )
        
        assert exit_code == 0
        assert "Total cost:" in stdout

    def test_cli_with_million_requests(self):
        """Test CLI with million requests unit."""
        stdout, stderr, exit_code = run_cli(
            "--region", "us-east-1",
            "--architecture", "x86",
            "--number-of-requests", "5",
            "--request-unit", "million per month",
            "--duration-of-each-request-in-ms", "100",
            "--memory", "512",
            "--memory-unit", "MB",
            "--ephemeral-storage", "512",
            "--storage-unit", "MB"
        )
        
        assert exit_code == 0
        assert "Total cost:" in stdout
