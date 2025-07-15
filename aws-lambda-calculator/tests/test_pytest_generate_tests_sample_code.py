from aws_lambda_calculator.calculator import calculate
from pytest import approx

# Define the test data as a list of dictionaries matching `calculate`'s parameter names
test_data = [
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 1_000_000,
            "request_unit": "per minute",
            "duration_of_each_request_in_ms": 100,
            "memory": 1024,
            "memory_unit": "MB",
            "ephemeral_storage": 1024,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        81_827.82,
    ),
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 500_000,
            "request_unit": "per day",
            "duration_of_each_request_in_ms": 200,
            "memory": 2048,
            "memory_unit": "MB",
            "ephemeral_storage": 1280,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        104.50,
    ),
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 2_000_000,
            "request_unit": "per month",
            "duration_of_each_request_in_ms": 500,
            "memory": 1536,
            "memory_unit": "MB",
            "ephemeral_storage": 4096,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        25.51,
    ),
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 10_000_000,
            "request_unit": "per hour",
            "duration_of_each_request_in_ms": 5,
            "memory": 1024,
            "memory_unit": "MB",
            "ephemeral_storage": 3900,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        2_072.06,
    ),
]


def pytest_generate_tests(metafunc):
    if "params" in metafunc.fixturenames:
        metafunc.parametrize("params,expected_cost", test_data)


def test_calculate_dynamic(params, expected_cost):
    result = calculate(**params)
    assert result == approx(
        expected_cost, abs=0.1
    ), f"Expected {expected_cost}, got {result}"
