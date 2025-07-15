from aws_lambda_calculator.calculator import calculate

# Define the test data as a list of dictionaries matching `calculate`'s parameter names
test_data = [
    # Free-tier test
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 1_000_000,
            "request_unit": "total",
            "duration_of_each_request_in_ms": 100,
            "memory": 1024,
            "memory_unit": "MB",
            "ephemeral_storage": 128,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        0.0,
    ),
    # Non-zero under free tier
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 500_000,
            "request_unit": "total",
            "duration_of_each_request_in_ms": 200,
            "memory": 2048,
            "memory_unit": "MB",
            "ephemeral_storage": 128,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        0.0,
    ),
    # Paid case
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 2_000_000,
            "request_unit": "total",
            "duration_of_each_request_in_ms": 500,
            "memory": 1536,
            "memory_unit": "MB",
            "ephemeral_storage": 128,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        18.53337,
    ),
    # Edge case: zero duration
    (
        {
            "region": "us-east-1",
            "architecture": "x86",
            "number_of_requests": 10_000_000,
            "request_unit": "total",
            "duration_of_each_request_in_ms": 0,
            "memory": 1024,
            "memory_unit": "MB",
            "ephemeral_storage": 128,
            "storage_unit": "MB",
            "duration_ms": 1,
        },
        1.8,
    ),
]


def pytest_generate_tests(metafunc):
    if "params" in metafunc.fixturenames:
        metafunc.parametrize("params,expected_cost", test_data)


def test_calculate_dynamic(params, expected_cost):
    result = calculate(**params)
    assert round(result, 5) == round(expected_cost, 5), (
        f"Expected {expected_cost}, got {result}"
    )
