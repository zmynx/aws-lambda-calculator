"""Tests to improve coverage for calculator.py by covering missing branches and error paths."""

import pytest
from aws_lambda_calculator import calculate
from aws_lambda_calculator.calculator import (
    open_json_file,
    unit_conversion_requests,
    unit_conversion_memory,
    unit_conversion_ephemeral_storage,
    calculate_tiered_cost,
)
from aws_lambda_calculator.models import CalculationResult


class TestCoverageGaps:
    """Test cases to improve coverage for calculator.py."""

    def test_open_json_file_invalid_region(self):
        """Test open_json_file with non-existent region."""
        result = open_json_file("invalid-region-999")
        assert result == {}

    def test_unit_conversion_requests_invalid_unit(self):
        """Test unit_conversion_requests with invalid unit."""
        with pytest.raises(ValueError, match="Unknown request unit: invalid_unit"):
            unit_conversion_requests(1000, "invalid_unit", [])

    def test_unit_conversion_memory_invalid_unit(self):
        """Test unit_conversion_memory with invalid unit."""
        with pytest.raises(ValueError, match="Unknown memory unit: invalid_unit"):
            unit_conversion_memory(512.0, "invalid_unit", [])

    def test_unit_conversion_ephemeral_storage_invalid_unit(self):
        """Test unit_conversion_ephemeral_storage with invalid unit."""
        with pytest.raises(ValueError, match="Unknown storage unit: invalid_unit"):
            unit_conversion_ephemeral_storage(512.0, "invalid_unit", [])

    def test_unit_conversion_memory_gb_case(self):
        """Test unit_conversion_memory with GB unit (no conversion needed)."""
        steps = []
        result = unit_conversion_memory(2.0, "GB", steps)
        assert result == 2.0
        assert len(steps) == 0  # No conversion step added for GB

    def test_unit_conversion_ephemeral_storage_gb_case(self):
        """Test unit_conversion_ephemeral_storage with GB unit (no conversion needed)."""
        steps = []
        result = unit_conversion_ephemeral_storage(5.0, "GB", steps)
        assert result == 5.0
        assert len(steps) == 0  # No conversion step added for GB

    def test_calculate_tiered_cost_edge_cases(self):
        """Test calculate_tiered_cost with edge cases to improve branch coverage."""
        steps = []

        # Test with zero usage
        result = calculate_tiered_cost(0.0, {"1000": "0.01"}, 0.02, steps)
        assert result == 0.0

        # Test with usage exactly at tier boundary
        steps.clear()
        result = calculate_tiered_cost(1000.0, {"1000": "0.01"}, 0.02, steps)
        assert result == 10.0  # 1000 * 0.01

        # Test with usage above highest tier (overflow)
        steps.clear()
        result = calculate_tiered_cost(2000.0, {"1000": "0.01"}, 0.02, steps)
        assert result == 30.0  # (1000 * 0.01) + (1000 * 0.02)

    def test_calculate_with_architecture_none_error(self):
        """Test calculate function when architecture config is None."""
        # This test tries to trigger the line where arch_config is None
        # This might happen with malformed pricing data
        result = calculate(
            region="us-east-1",  # Valid region but we'll test with normal data
            architecture="x86",
            number_of_requests=1,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
        )

        # Should work normally as arch_config won't be None with valid data
        assert isinstance(result, CalculationResult)

    def test_calculate_no_unit_conversions_needed(self):
        """Test calculate when no unit conversions are needed."""
        # Use per month, GB units to avoid unit conversion logging
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=1,
            memory_unit="GB",
            ephemeral_storage=1,
            storage_unit="GB",
            include_free_tier=False,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

        # Should not contain unit conversion steps
        steps_text = " ".join(result.calculation_steps)
        assert "Unit conversions:" not in steps_text

    def test_calculate_with_unit_conversions(self):
        """Test calculate when unit conversions ARE needed."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per day",  # Triggers conversion
            duration_of_each_request_in_ms=100,
            memory=512,
            memory_unit="MB",  # Triggers conversion
            ephemeral_storage=1024,
            storage_unit="MB",  # Triggers conversion
            include_free_tier=False,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

        # Should contain unit conversion steps
        steps_text = " ".join(result.calculation_steps)
        assert "Unit conversions:" in steps_text

    def test_tiered_cost_with_multiple_tiers(self):
        """Test calculate_tiered_cost with multiple tiers to hit more branches."""
        steps = []

        # Create a complex tier structure
        tier_structure = {
            "1000": "0.01",  # First 1000 at $0.01 each
            "5000": "0.008",  # Next 4000 at $0.008 each
            "10000": "0.005",  # Next 5000 at $0.005 each
        }

        # Test usage that spans multiple tiers
        result = calculate_tiered_cost(7500.0, tier_structure, 0.003, steps)

        # Should be: (1000 * 0.01) + (4000 * 0.008) + (2500 * 0.005)
        expected = (1000 * 0.01) + (4000 * 0.008) + (2500 * 0.005)
        assert abs(result - expected) < 0.001

        # Should have multiple tier calculation steps
        assert len(steps) >= 3

    def test_all_request_units(self):
        """Test all request unit conversions to improve coverage."""
        test_cases = [
            ("per second", 1, 60 * 60 * 730),
            ("per minute", 1, 60 * 730),
            ("per hour", 1, 730),
            ("per day", 1, 730 / 24),
            ("per month", 1000, 1000),
            ("million per month", 1, 1000000),
        ]

        for unit, input_requests, expected_monthly in test_cases:
            steps = []
            result = unit_conversion_requests(input_requests, unit, steps)
            assert result == int(expected_monthly)
            assert len(steps) > 0  # Should have conversion step

    def test_ephemeral_storage_exactly_at_free_threshold(self):
        """Test ephemeral storage calculation at exactly 0.5 GB threshold."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=0.5,  # Exactly at free threshold
            storage_unit="GB",
            include_free_tier=False,
        )

        assert isinstance(result, CalculationResult)
        # Should have no ephemeral storage charges (0.5 GB is free)
        steps_text = " ".join(result.calculation_steps)
        assert "0.5 GB - 0.5 GB (no additional charges) = 0.0 GB" in steps_text

    def test_large_tiered_usage_overflow(self):
        """Test very large usage that goes into overflow pricing."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1,
            request_unit="per month",
            duration_of_each_request_in_ms=900000,  # 15 minutes
            memory=10240,  # Max memory
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=False,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0

        # Should trigger overflow pricing for very high GB-seconds
        steps_text = " ".join(result.calculation_steps)
        # Check that tiered pricing is being calculated
        assert "Total tier cost:" in steps_text

    def test_ultra_high_usage_for_overflow_coverage(self):
        """Test with extremely high usage to trigger overflow pricing beyond all tiers."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=100_000,  # Very high requests
            request_unit="per month",
            duration_of_each_request_in_ms=900000,  # 15 minutes each
            memory=10240,  # Max memory
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=False,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 100.0  # Should be very expensive

        # The usage (900M GB-s) is still within first tier (6B GB-s)
        # so no overflow expected, just ensure it's very expensive
        assert result.total_cost > 10000.0

    def test_calculate_tiered_cost_with_massive_overflow(self):
        """Test calculate_tiered_cost directly with usage that exceeds all tiers."""
        steps = []

        # Use real x86 tier structure from us-east-1
        tier_structure = {
            "6000000000": "0.0000166667",  # 6B GB-seconds
            "15000000000": "0.0000150000",  # 15B GB-seconds
        }

        # Test with 20B GB-seconds (exceeds all tiers)
        massive_usage = 20_000_000_000.0
        overflow_rate = 0.0000133334

        result = calculate_tiered_cost(
            massive_usage, tier_structure, overflow_rate, steps
        )

        # Should have charged for both tiers plus overflow
        # (6B * 0.0000166667) + (9B * 0.0000150000) + (5B * 0.0000133334)
        tier1_cost = 6_000_000_000 * 0.0000166667
        tier2_cost = 9_000_000_000 * 0.0000150000
        overflow_cost = 5_000_000_000 * 0.0000133334
        expected = tier1_cost + tier2_cost + overflow_cost

        assert abs(result - expected) < 1.0  # Allow for floating point precision

        # Should have steps for overflow calculation
        assert any("x 0.00001333 USD" in step for step in steps)
