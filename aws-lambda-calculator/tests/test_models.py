import pytest
from pydantic import ValidationError
from aws_lambda_calculator.models import CalculationRequest, CalculationResult


class TestCalculationRequest:
    """Tests for CalculationRequest pydantic model validation."""

    def test_valid_calculation_request(self):
        """Test valid calculation request."""
        request = CalculationRequest(
            region="us-east-1",
            architecture="x86",
            number_of_requests=1000,
            request_unit="per day",
            duration_of_each_request_in_ms=100,
            memory=512,
            memory_unit="MB",
            ephemeral_storage=1024,
            storage_unit="MB"
        )
        assert request.region == "us-east-1"
        assert request.architecture == "x86"
        assert request.number_of_requests == 1000

    def test_default_values(self):
        """Test default values are applied correctly."""
        request = CalculationRequest()
        assert request.region == "us-east-1"
        assert request.architecture == "x86"
        assert request.number_of_requests == 1000000
        assert request.request_unit == "per day"
        assert request.duration_of_each_request_in_ms == 1500
        assert request.memory == 128
        assert request.memory_unit == "MB"
        assert request.ephemeral_storage == 512
        assert request.storage_unit == "MB"

    def test_invalid_architecture(self):
        """Test invalid architecture raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(architecture="invalid")
        assert "architecture" in str(exc_info.value)

    def test_invalid_request_unit(self):
        """Test invalid request unit raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(request_unit="invalid")
        assert "request_unit" in str(exc_info.value)

    def test_invalid_memory_unit(self):
        """Test invalid memory unit raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory_unit="invalid")
        assert "memory_unit" in str(exc_info.value)

    def test_invalid_storage_unit(self):
        """Test invalid storage unit raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(storage_unit="invalid")
        assert "storage_unit" in str(exc_info.value)

    def test_negative_number_of_requests(self):
        """Test negative number of requests raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(number_of_requests=-1)
        assert "number_of_requests" in str(exc_info.value)

    def test_zero_number_of_requests(self):
        """Test zero number of requests raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(number_of_requests=0)
        assert "number_of_requests" in str(exc_info.value)

    def test_negative_duration(self):
        """Test negative duration raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(duration_of_each_request_in_ms=-1)
        assert "duration_of_each_request_in_ms" in str(exc_info.value)

    def test_zero_duration(self):
        """Test zero duration raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(duration_of_each_request_in_ms=0)
        assert "duration_of_each_request_in_ms" in str(exc_info.value)

    def test_negative_memory(self):
        """Test negative memory raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory=-1)
        assert "memory" in str(exc_info.value)

    def test_zero_memory(self):
        """Test zero memory raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory=0)
        assert "memory" in str(exc_info.value)

    def test_negative_ephemeral_storage(self):
        """Test negative ephemeral storage raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(ephemeral_storage=-1)
        assert "ephemeral_storage" in str(exc_info.value)

    def test_zero_ephemeral_storage(self):
        """Test zero ephemeral storage raises validation error."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(ephemeral_storage=0)
        assert "ephemeral_storage" in str(exc_info.value)

    def test_memory_validation_mb_too_low(self):
        """Test memory validation - MB too low."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory=100, memory_unit="MB")
        assert "Memory must be between 128 MB and 10,240 MB" in str(exc_info.value)

    def test_memory_validation_mb_too_high(self):
        """Test memory validation - MB too high."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory=15000, memory_unit="MB")
        assert "Memory must be between 128 MB and 10,240 MB" in str(exc_info.value)

    def test_memory_validation_gb_too_low(self):
        """Test memory validation - GB too low."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory=0.1, memory_unit="GB")
        assert "Memory must be between 0.125 GB and 10.24 GB" in str(exc_info.value)

    def test_memory_validation_gb_too_high(self):
        """Test memory validation - GB too high."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(memory=15, memory_unit="GB")
        assert "Memory must be between 0.125 GB and 10.24 GB" in str(exc_info.value)

    def test_ephemeral_storage_validation_mb_too_low(self):
        """Test ephemeral storage validation - MB too low."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(ephemeral_storage=400, storage_unit="MB")
        assert "Ephemeral storage must be between 512 MB and 10,240 MB" in str(exc_info.value)

    def test_ephemeral_storage_validation_mb_too_high(self):
        """Test ephemeral storage validation - MB too high."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(ephemeral_storage=15000, storage_unit="MB")
        assert "Ephemeral storage must be between 512 MB and 10,240 MB" in str(exc_info.value)

    def test_ephemeral_storage_validation_gb_too_low(self):
        """Test ephemeral storage validation - GB too low."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(ephemeral_storage=0.4, storage_unit="GB")
        assert "Ephemeral storage must be between 0.5 GB and 10.24 GB" in str(exc_info.value)

    def test_ephemeral_storage_validation_gb_too_high(self):
        """Test ephemeral storage validation - GB too high."""
        with pytest.raises(ValidationError) as exc_info:
            CalculationRequest(ephemeral_storage=15, storage_unit="GB")
        assert "Ephemeral storage must be between 0.5 GB and 10.24 GB" in str(exc_info.value)

    def test_valid_memory_mb_boundary(self):
        """Test valid memory at MB boundaries."""
        # Lower boundary
        request = CalculationRequest(memory=128, memory_unit="MB", ephemeral_storage=512, storage_unit="MB")
        assert request.memory == 128
        
        # Upper boundary
        request = CalculationRequest(memory=10240, memory_unit="MB", ephemeral_storage=512, storage_unit="MB")
        assert request.memory == 10240

    def test_valid_memory_gb_boundary(self):
        """Test valid memory at GB boundaries."""
        # Lower boundary
        request = CalculationRequest(memory=0.125, memory_unit="GB", ephemeral_storage=0.5, storage_unit="GB")
        assert request.memory == 0.125
        
        # Upper boundary
        request = CalculationRequest(memory=10.24, memory_unit="GB", ephemeral_storage=0.5, storage_unit="GB")
        assert request.memory == 10.24

    def test_valid_ephemeral_storage_mb_boundary(self):
        """Test valid ephemeral storage at MB boundaries."""
        # Lower boundary
        request = CalculationRequest(memory=512, memory_unit="MB", ephemeral_storage=512, storage_unit="MB")
        assert request.ephemeral_storage == 512
        
        # Upper boundary
        request = CalculationRequest(memory=512, memory_unit="MB", ephemeral_storage=10240, storage_unit="MB")
        assert request.ephemeral_storage == 10240

    def test_valid_ephemeral_storage_gb_boundary(self):
        """Test valid ephemeral storage at GB boundaries."""
        # Lower boundary
        request = CalculationRequest(memory=0.5, memory_unit="GB", ephemeral_storage=0.5, storage_unit="GB")
        assert request.ephemeral_storage == 0.5
        
        # Upper boundary
        request = CalculationRequest(memory=0.5, memory_unit="GB", ephemeral_storage=10.24, storage_unit="GB")
        assert request.ephemeral_storage == 10.24

    def test_arm64_architecture(self):
        """Test ARM64 architecture is valid."""
        request = CalculationRequest(architecture="arm64", ephemeral_storage=512, storage_unit="MB")
        assert request.architecture == "arm64"


class TestCalculationResult:
    """Tests for CalculationResult pydantic model."""

    def test_valid_calculation_result(self):
        """Test valid calculation result."""
        result = CalculationResult(
            total_cost=10.50,
            calculation_steps=["Step 1", "Step 2", "Step 3"]
        )
        assert result.total_cost == 10.50
        assert len(result.calculation_steps) == 3
        assert result.calculation_steps[0] == "Step 1"

    def test_calculation_result_empty_steps(self):
        """Test calculation result with empty steps."""
        result = CalculationResult(
            total_cost=0.0,
            calculation_steps=[]
        )
        assert result.total_cost == 0.0
        assert len(result.calculation_steps) == 0

    def test_calculation_result_negative_cost(self):
        """Test calculation result can have negative cost (edge case)."""
        result = CalculationResult(
            total_cost=-5.0,
            calculation_steps=["Error occurred"]
        )
        assert result.total_cost == -5.0

    def test_calculation_result_missing_fields(self):
        """Test calculation result with missing required fields."""
        with pytest.raises(ValidationError):
            CalculationResult(total_cost=10.0)  # Missing calculation_steps
        
        with pytest.raises(ValidationError):
            CalculationResult(calculation_steps=["Step 1"])  # Missing total_cost