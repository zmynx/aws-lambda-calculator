import pytest
from pytest import approx
from aws_lambda_calculator.calculator import calculate


@pytest.mark.parametrize(
    (
        "region",
        "architecture",
        "number_of_requests",
        "request_unit",
        "duration_of_each_request_in_ms",
        "memory",
        "memory_unit",
        "ephemeral_storage",
        "storage_unit",
        "expected_cost",
    ),
    [
        # Free-tier test
        (
            "us-east-1",
            "x86",
            1_000_000,
            "per day",
            100,
            1024,
            "MB",
            512,
            "MB",
            56.77,
        ),
        ("us-east-1", "x86", 500_000, "per month", 200, 2048, "MB", 512, "MB", 3.43),
        (
            "us-east-1",
            "x86",
            2_000_000,
            "per minute",
            500,
            1536,
            "MB",
            512,
            "MB",
            928_523.58,
        ),
        (
            "us-east-1",
            "x86",
            50_000_000,
            "per hour",
            1000,
            2048,
            "MB",
            512,
            "MB",
            1_015_637.40,
        ),
        (
            "us-east-1",
            "x86",
            10_000_000,
            "per minute",
            1,
            1024,
            "MB",
            512,
            "MB",
            94_900.01,
        ),
        ("us-east-1", "x86", 50, "per hour", 100, 1024, "MB", 5120, "MB", 0.07),
        (
            "us-east-1",
            "x86",
            1_000_000,
            "per day",
            100,
            8192,
            "MB",
            512,
            "MB",
            411.64,
        ),
        (
            "us-east-1",
            "x86",
            5_000_000,
            "million per month",
            300,
            2048,
            "MB",
            512,
            "MB",
            41_035_199.20,
        ),
    ],
)
def test_calculate(
    region,
    architecture,
    number_of_requests,
    request_unit,
    duration_of_each_request_in_ms,
    memory,
    memory_unit,
    ephemeral_storage,
    storage_unit,
    expected_cost,
):
    result = calculate(
        region=region,
        architecture=architecture,
        number_of_requests=number_of_requests,
        request_unit=request_unit,
        duration_of_each_request_in_ms=duration_of_each_request_in_ms,
        memory=memory,
        memory_unit=memory_unit,
        ephemeral_storage=ephemeral_storage,
        storage_unit=storage_unit,
    )
    assert result.total_cost == approx(expected_cost, abs=0.01), (
        f"Expected {expected_cost}, got {result.total_cost}"
    )
    # Verify that calculation_steps is a list and contains calculation information
    assert isinstance(result.calculation_steps, list)
    assert len(result.calculation_steps) > 0
