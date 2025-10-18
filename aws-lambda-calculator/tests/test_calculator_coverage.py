import pytest
from pytest import approx
from aws_lambda_calculator.calculator import (
    calculate,
    open_json_file,
    unit_conversion_requests,
    unit_conversion_memory,
    unit_conversion_ephemeral_storage,
    calculate_tiered_cost,
)
from aws_lambda_calculator.models import CalculationResult
from pydantic import ValidationError


class TestCalculatorFunctionCoverage:
    """Tests to improve coverage of calculator functions."""

    def test_open_json_file_valid_region(self):
        """Test opening JSON file for valid region."""
        result = open_json_file("us-east-1")
        assert isinstance(result, dict)
        assert "Requests" in result
        assert "EphemeralStorage" in result

    def test_open_json_file_invalid_region(self):
        """Test opening JSON file for invalid region."""
        result = open_json_file("invalid-region")
        assert result == {}

    def test_unit_conversion_requests_per_second(self):
        """Test request conversion for per second unit."""
        result = unit_conversion_requests(100, "per second")
        expected = 100 * 60 * 60 * 730  # per second to per month
        assert result == expected

    def test_unit_conversion_requests_per_minute(self):
        """Test request conversion for per minute unit."""
        result = unit_conversion_requests(100, "per minute")
        expected = 100 * 60 * 730  # per minute to per month
        assert result == expected

    def test_unit_conversion_requests_per_hour(self):
        """Test request conversion for per hour unit."""
        result = unit_conversion_requests(100, "per hour")
        expected = 100 * 730  # per hour to per month
        assert result == expected

    def test_unit_conversion_requests_per_day(self):
        """Test request conversion for per day unit."""
        result = unit_conversion_requests(100, "per day")
        expected = int(100 * (730 / 24))  # per day to per month
        assert result == expected

    def test_unit_conversion_requests_per_month(self):
        """Test request conversion for per month unit."""
        result = unit_conversion_requests(100, "per month")
        assert result == 100

    def test_unit_conversion_requests_million_per_month(self):
        """Test request conversion for million per month unit."""
        result = unit_conversion_requests(5, "million per month")
        assert result == 5_000_000

    def test_unit_conversion_requests_invalid_unit(self):
        """Test request conversion with invalid unit."""
        with pytest.raises(ValueError, match="Unknown request unit"):
            unit_conversion_requests(100, "invalid-unit")

    def test_unit_conversion_memory_mb(self):
        """Test memory conversion from MB."""
        result = unit_conversion_memory(1024, "MB")
        expected = 1024 * 0.0009765625  # MB to GB
        assert result == approx(expected)

    def test_unit_conversion_memory_gb(self):
        """Test memory conversion from GB."""
        result = unit_conversion_memory(2, "GB")
        assert result == 2

    def test_unit_conversion_memory_invalid_unit(self):
        """Test memory conversion with invalid unit."""
        with pytest.raises(ValueError, match="Unknown memory unit"):
            unit_conversion_memory(1024, "invalid-unit")

    def test_unit_conversion_ephemeral_storage_mb(self):
        """Test ephemeral storage conversion from MB."""
        result = unit_conversion_ephemeral_storage(1024, "MB")
        expected = 1024 * 0.0009765625  # MB to GB
        assert result == approx(expected)

    def test_unit_conversion_ephemeral_storage_gb(self):
        """Test ephemeral storage conversion from GB."""
        result = unit_conversion_ephemeral_storage(2, "GB")
        assert result == 2

    def test_unit_conversion_ephemeral_storage_invalid_unit(self):
        """Test ephemeral storage conversion with invalid unit."""
        with pytest.raises(ValueError, match="Unknown storage unit"):
            unit_conversion_ephemeral_storage(1024, "invalid-unit")

    def test_calculate_tiered_cost_simple(self):
        """Test tiered cost calculation with simple case."""
        tier_cost_factor = {"1000": "0.0000002083"}
        overflow_rate = 0.0000133334
        result = calculate_tiered_cost(500.0, tier_cost_factor, overflow_rate)
        expected = 500.0 * 0.0000002083
        assert result == approx(expected, abs=0.0001)

    def test_calculate_tiered_cost_with_overflow(self):
        """Test tiered cost calculation with overflow."""
        tier_cost_factor = {"1000": "0.0000002083"}
        overflow_rate = 0.0000133334
        result = calculate_tiered_cost(1500.0, tier_cost_factor, overflow_rate)
        tier_cost = 1000.0 * 0.0000002083
        overflow_cost = 500.0 * overflow_rate
        expected = tier_cost + overflow_cost
        assert result == approx(expected, abs=0.0001)

    def test_calculate_with_all_unit_combinations(self):
        """Test calculate function with different unit combinations."""
        # Test with GB units
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per second",
            duration_of_each_request_in_ms=100,
            memory=1,
            memory_unit="GB",
            ephemeral_storage=1,
            storage_unit="GB",
        )
        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0
        assert len(result.calculation_steps) > 0

    def test_calculate_with_arm64_architecture(self):
        """Test calculate function with ARM64 architecture."""
        result = calculate(
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
        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

    def test_calculate_with_invalid_architecture(self):
        """Test calculate function with invalid architecture raises validation error."""
        with pytest.raises(ValidationError):
            calculate(
                region="us-east-1",
                architecture="invalid-arch",
                number_of_requests=1000,
                request_unit="per hour",
                duration_of_each_request_in_ms=100,
                memory=512,
                memory_unit="MB",
                ephemeral_storage=512,
                storage_unit="MB",
            )
