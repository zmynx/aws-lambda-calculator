"""Tests for AWS Lambda free tier functionality."""

import pytest
from aws_lambda_calculator import calculate
from aws_lambda_calculator.models import CalculationResult


class TestFreeTier:
    """Test cases for AWS Lambda free tier calculations."""

    def test_free_tier_usage_under_all_limits(self):
        """Test when usage is completely within free tier limits."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=500_000,  # Under 1M free requests
            request_unit="per month",
            duration_of_each_request_in_ms=100,  # Low duration
            memory=128,  # Minimal memory
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost == 0.0
        
        # Verify calculation steps mention free tier
        steps_text = " ".join(result.calculation_steps)
        assert "free tier" in steps_text
        assert "500000 requests - 1000000 free tier requests = 0 monthly billable requests" in steps_text

    def test_free_tier_requests_over_limit(self):
        """Test when request count exceeds free tier limit."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1_500_000,  # Over 1M free requests
            request_unit="per month",
            duration_of_each_request_in_ms=50,  # Keep compute low
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0.0
        
        # Should charge for 500k requests (1.5M - 1M free)
        steps_text = " ".join(result.calculation_steps)
        assert "1500000 requests - 1000000 free tier requests = 500000 monthly billable requests" in steps_text
        assert "500000 requests x" in steps_text  # Should show billing for excess requests

    def test_free_tier_compute_over_limit(self):
        """Test when compute GB-seconds exceeds free tier limit."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,  # Under request limit
            request_unit="per month",
            duration_of_each_request_in_ms=900_000,  # 15 minutes per request
            memory=10240,  # Maximum memory to maximize GB-seconds
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0.0
        
        # Should have compute charges but no request charges
        steps_text = " ".join(result.calculation_steps)
        assert "1000 requests - 1000000 free tier requests = 0 monthly billable requests" in steps_text
        assert "free tier GB-s" in steps_text
        assert "billable GB-s" in steps_text

    def test_free_tier_disabled(self):
        """Test when free tier is explicitly disabled."""
        result_with_free_tier = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=500_000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        result_without_free_tier = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=500_000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=False,
        )

        assert isinstance(result_with_free_tier, CalculationResult)
        assert isinstance(result_without_free_tier, CalculationResult)
        
        # With free tier should be $0, without should have cost
        assert result_with_free_tier.total_cost == 0.0
        assert result_without_free_tier.total_cost > 0.0
        
        # Verify no free tier mentions when disabled
        steps_text = " ".join(result_without_free_tier.calculation_steps)
        assert "free tier" not in steps_text

    def test_free_tier_both_limits_exceeded(self):
        """Test when both request and compute limits are exceeded."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=2_000_000,  # Over request limit
            request_unit="per month",
            duration_of_each_request_in_ms=1000,  # High duration
            memory=1024,  # High memory
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 0.0
        
        steps_text = " ".join(result.calculation_steps)
        
        # Should show free tier deductions for both requests and compute
        assert "2000000 requests - 1000000 free tier requests = 1000000 monthly billable requests" in steps_text
        assert "free tier GB-s" in steps_text
        assert "billable GB-s" in steps_text
        
        # Should have charges for both requests and compute
        assert "1000000 requests x" in steps_text  # Request charges
        assert "Monthly compute charges:" in steps_text and not "0.0 USD" in result.calculation_steps[-5]  # Compute charges

    def test_free_tier_edge_case_exact_limits(self):
        """Test edge case where usage exactly meets free tier limits."""
        # Exactly 1M requests
        result_requests = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1_000_000,
            request_unit="per month",
            duration_of_each_request_in_ms=50,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result_requests, CalculationResult)
        assert result_requests.total_cost == 0.0
        
        steps_text = " ".join(result_requests.calculation_steps)
        assert "1000000 requests - 1000000 free tier requests = 0 monthly billable requests" in steps_text

    def test_free_tier_calculation_steps_content(self):
        """Test that free tier information appears correctly in calculation steps."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1_200_000,  # Slightly over limit
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=512,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result, CalculationResult)
        assert len(result.calculation_steps) > 0
        
        # Check for specific free tier calculation steps
        steps = result.calculation_steps
        
        # Should contain request free tier calculation
        request_step_found = any("1200000 requests - 1000000 free tier requests" in step for step in steps)
        assert request_step_found, "Request free tier calculation not found in steps"
        
        # Should contain compute free tier calculation
        compute_step_found = any("free tier GB-s" in step for step in steps)
        assert compute_step_found, "Compute free tier calculation not found in steps"

    def test_free_tier_with_different_architectures(self):
        """Test free tier works correctly with different architectures."""
        # Test with x86
        result_x86 = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=500_000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        # Test with arm64
        result_arm64 = calculate(
            region="us-east-1",
            architecture="arm64",
            number_of_requests=500_000,
            request_unit="per month",
            duration_of_each_request_in_ms=100,
            memory=128,
            memory_unit="MB",
            ephemeral_storage=512,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result_x86, CalculationResult)
        assert isinstance(result_arm64, CalculationResult)
        
        # Both should be free under the same free tier limits
        assert result_x86.total_cost == 0.0
        assert result_arm64.total_cost == 0.0

    def test_free_tier_high_usage_scenario(self):
        """Test free tier with high usage that definitely exceeds all limits."""
        result = calculate(
            region="us-east-1",
            architecture="x86",
            number_of_requests=10_000_000,  # 10M requests
            request_unit="per month",
            duration_of_each_request_in_ms=5000,  # 5 seconds each
            memory=3008,  # High memory
            memory_unit="MB",
            ephemeral_storage=1024,
            storage_unit="MB",
            include_free_tier=True,
        )

        assert isinstance(result, CalculationResult)
        assert result.total_cost > 10.0  # Should be significant cost
        
        steps_text = " ".join(result.calculation_steps)
        
        # Should show proper free tier deductions
        assert "10000000 requests - 1000000 free tier requests = 9000000 monthly billable requests" in steps_text
        assert "free tier GB-s" in steps_text
        
        # Should have substantial charges for both requests and compute
        assert "9000000 requests x" in steps_text