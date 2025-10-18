import json
from test_cli import run_cli
from aws_lambda import handler
from aws_lambda_calculator import calculate
from aws_lambda_calculator.models import CalculationResult


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_minimal_requests_per_month(self):
        """Test with minimal number of requests."""
        stdout, stderr, exit_code = run_cli(
            "--region",
            "us-east-1",
            "--architecture",
            "x86",
            "--number-of-requests",
            "1",
            "--request-unit",
            "per month",
            "--duration-of-each-request-in-ms",
            "1",
            "--memory",
            "128",  # Minimum memory
            "--memory-unit",
            "MB",
            "--ephemeral-storage",
            "512",  # Minimum ephemeral storage
            "--storage-unit",
            "MB",
        )

        assert exit_code == 0
        assert "Total cost:" in stdout

    def test_maximum_memory_mb(self):
        """Test with maximum memory in MB."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=10240,  # Maximum MB
            memory_unit="MB",
            ephemeral_storage=10240,  # Maximum MB
            storage_unit="MB",
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

    def test_maximum_memory_gb(self):
        """Test with maximum memory in GB."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=10.24,  # Maximum GB
            memory_unit="GB",
            ephemeral_storage=10.24,  # Maximum GB
            storage_unit="GB",
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

    def test_very_large_number_of_requests(self):
        """Test with very large number of requests."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000000000,  # 1 billion
            request_unit="per month",
            duration_of_each_request_in_ms=1,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

    def test_very_long_duration(self):
        """Test with very long request duration."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1,
            request_unit="per month",
            duration_of_each_request_in_ms=900000,  # 15 minutes
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

    def test_all_time_units(self):
        """Test all different time units work correctly."""
        time_units = [
            "per second",
            "per minute",
            "per hour",
            "per day",
            "per month",
            "million per month",
        ]

        for unit in time_units:
            result = calculate(
                region="us-east-1",
                architecture="x86",
                number_of_requests=1000,
                request_unit=unit,
                duration_of_each_request_in_ms=100,
                memory=512,
                memory_unit="MB",
                ephemeral_storage=512,
                storage_unit="MB",
            )

            assert isinstance(result, CalculationResult)
            assert result.total_cost >= 0
            assert len(result.calculation_steps) > 0

    def test_different_regions(self):
        """Test with different AWS regions."""
        regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"]

        for region in regions:
            result = calculate(
                region=region,
                architecture="x86",
                number_of_requests=1000,
                request_unit="per hour",
                duration_of_each_request_in_ms=100,
                memory=512,
                memory_unit="MB",
                ephemeral_storage=512,
                storage_unit="MB",
            )

            assert isinstance(result, CalculationResult)
            assert result.total_cost >= 0

    def test_arm64_vs_x86_different_costs(self):
        """Test that ARM64 and x86 architectures may have different costs."""
        # Test x86
        result_x86 = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per hour",
            duration_of_each_request_in_ms=100,
            memory=512,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
        )

        # Test ARM64
        result_arm64 = calculate(
            region="us-east-1",
            architecture="arm64",
            number_of_requests=1000,
            request_unit="per hour",
            duration_of_each_request_in_ms=100,
            memory=512,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
        )

        assert isinstance(result_x86, CalculationResult)
        assert isinstance(result_arm64, CalculationResult)
        # ARM64 is typically cheaper, but costs may vary by region
        assert result_x86.total_cost >= 0
        assert result_arm64.total_cost >= 0

    def test_lambda_with_extreme_values(self):
        """Test Lambda handler with extreme but valid values."""
        payload = {
            "region": "us-east-1",
            "architecture": "arm64",
            "number_of_requests": 1000000,
            "request_unit": "per second",
            "duration_of_each_request_in_ms": 30000,  # 30 seconds (Lambda max)
            "memory": 10240,  # Maximum memory
            "memory_unit": "MB",
            "ephemeral_storage": 10240,  # Maximum ephemeral storage
            "storage_unit": "MB",
            "verbose": True,
        }
        event = {"body": json.dumps(payload)}
        response = handler(event, None)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "success"
        assert isinstance(body["cost"], float)
        assert body["cost"] > 0
        assert "calculation_steps" in body

    def test_calculation_steps_content(self):
        """Test that calculation steps contain meaningful information."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per minute",
            duration_of_each_request_in_ms=100,
            memory=1024,
            memory_unit="MB",
            ephemeral_storage=1024,
            storage_unit="MB",
        )

        assert isinstance(result, CalculationResult)
        steps = result.calculation_steps
        assert len(steps) > 0

        # Check that steps contain expected calculation information
        step_text = " ".join(steps)
        assert "per month" in step_text.lower()
        assert "usd" in step_text.lower()
        assert "lambda cost" in step_text.lower()

    def test_minimal_ephemeral_storage_gb(self):
        """Test with minimum ephemeral storage in GB."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per hour",
            duration_of_each_request_in_ms=100,
            memory=512,
            memory_unit="MB",
            ephemeral_storage=0.5,  # Minimum GB
            storage_unit="GB",
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost >= 0

    def test_mixed_units_combinations(self):
        """Test various combinations of memory and storage units."""
        combinations = [("MB", "MB"), ("MB", "GB"), ("GB", "MB"), ("GB", "GB")]

        for memory_unit, storage_unit in combinations:
            memory = 1 if memory_unit == "GB" else 1024
            storage = 1 if storage_unit == "GB" else 1024

            result = calculate(
                region="us-east-1",
                architecture="x86",
                number_of_requests=1000,
                request_unit="per hour",
                duration_of_each_request_in_ms=100,
                memory=memory,
                memory_unit=memory_unit,
                ephemeral_storage=storage,
                storage_unit=storage_unit,
            )

            assert isinstance(result, CalculationResult)
            assert result.total_cost >= 0

    def test_cli_with_float_memory_values(self):
        """Test CLI with float memory values."""
        stdout, stderr, exit_code = run_cli(
            "--region",
            "us-east-1",
            "--architecture",
            "x86",
            "--number-of-requests",
            "1000",
            "--request-unit",
            "per hour",
            "--duration-of-each-request-in-ms",
            "100",
            "--memory",
            "1.5",  # Float value
            "--memory-unit",
            "GB",
            "--ephemeral-storage",
            "2.5",  # Float value
            "--storage-unit",
            "GB",
        )

        assert exit_code == 0
        assert "Total cost:" in stdout
