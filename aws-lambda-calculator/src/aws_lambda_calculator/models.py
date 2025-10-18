from pydantic import BaseModel, Field, model_validator
from typing import Literal


class CalculationRequest(BaseModel):
    """Pydantic model for AWS Lambda cost calculation request parameters."""

    region: str = Field(default="us-east-1", description="AWS region for pricing")

    architecture: Literal["x86", "arm64"] = Field(
        default="x86", description="Lambda function architecture"
    )

    number_of_requests: int = Field(
        default=1000000, gt=0, description="Number of Lambda requests"
    )

    request_unit: Literal[
        "per second",
        "per minute",
        "per hour",
        "per day",
        "per month",
        "million per month",
    ] = Field(default="per day", description="Unit for number of requests")

    duration_of_each_request_in_ms: int = Field(
        default=1500, gt=0, description="Duration of each request in milliseconds"
    )

    memory: float = Field(
        default=128, gt=0, description="Memory allocated to Lambda function"
    )

    memory_unit: Literal["MB", "GB"] = Field(
        default="MB", description="Unit for memory allocation"
    )

    ephemeral_storage: float = Field(
        default=512, gt=0, description="Ephemeral storage allocated to Lambda function"
    )

    storage_unit: Literal["MB", "GB"] = Field(
        default="MB", description="Unit for ephemeral storage"
    )

    include_free_tier: bool = Field(
        default=True, description="Whether to include AWS Lambda free tier benefits"
    )

    @model_validator(mode="after")
    def validate_aws_lambda_limits(self) -> "CalculationRequest":
        """Validate memory and ephemeral storage are within AWS Lambda limits."""
        # Validate memory
        if self.memory_unit == "MB":
            if self.memory < 128 or self.memory > 10240:
                raise ValueError("Memory must be between 128 MB and 10,240 MB")
        elif self.memory_unit == "GB":
            if self.memory < 0.125 or self.memory > 10.24:
                raise ValueError("Memory must be between 0.125 GB and 10.24 GB")

        # Validate ephemeral storage
        if self.storage_unit == "MB":
            if self.ephemeral_storage < 512 or self.ephemeral_storage > 10240:
                raise ValueError(
                    "Ephemeral storage must be between 512 MB and 10,240 MB"
                )
        elif self.storage_unit == "GB":
            if self.ephemeral_storage < 0.5 or self.ephemeral_storage > 10.24:
                raise ValueError(
                    "Ephemeral storage must be between 0.5 GB and 10.24 GB"
                )

        return self


class CalculationResult(BaseModel):
    """Pydantic model for AWS Lambda cost calculation result."""

    total_cost: float = Field(description="Total monthly cost in USD")

    calculation_steps: list[str] = Field(
        description="Step-by-step calculation breakdown"
    )
