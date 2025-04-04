import pytest
from aws_lambda_calculator.calculator import calculate


@pytest.mark.parametrize(
    "duration, requests_millions, concurrency, ram, expected_cost",
    [
        # Free-tier test (should be zero cost)
        (100, 1, 1, 1.0, 0.0),
        # Below free-tier but non-zero (should be zero cost)
        (200, 0.5, 2, 2.0, 0.0),
        # Small cost case
        (500, 2, 10, 1.5, 18.53337),
        # Large request volume
        (1000, 50, 5, 2.0, 1669.80332),
        # Edge case: zero duration (no cost)
        (0, 10, 3, 1.0, 1.8),
        # Edge case: zero requests (no cost)
        (100, 0, 1, 1.0, 0.0),
        # High RAM, low requests (should be low cost)
        (100, 1, 1, 8.0, 6.66668),
        # High concurrency (doesn't affect cost directly)
        (300, 5, 50, 2.0, 44.13342),
    ],
)
def test_calculate(duration, requests_millions, concurrency, ram, expected_cost):
    cost = calculate(duration, requests_millions, concurrency, ram)
    assert round(cost, 5) == round(expected_cost, 5), (
        f"Expected {expected_cost}, got {cost}"
    )
