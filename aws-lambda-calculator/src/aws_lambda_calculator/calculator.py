import os
from dotenv import load_dotenv
import logging

# Load environment variables from .env file
load_dotenv()

# Load cost factors from environment variables (fallback to defaults)
COST_FACTORS = {
    "duration": float(os.getenv("DURATION_COST", 0.0000166667)),
    "millions_requests": float(os.getenv("MILLIONS_REQUESTS_COST", 0.20)),
    "concurrency": float(os.getenv("CONCURRENCY_COST", 0.000041667)),
    "storage": float(os.getenv("STORAGE_COST", 0.000000)),
    "free_tier_duration": int(os.getenv("FREE_TIER_DURATION", 400000)),
    "free_tier_requests": int(os.getenv("FREE_TIER_REQUESTS", 1000000)),
    "request_cost_per_unit": float(os.getenv("REQUEST_COST_PER_UNIT", 0.0000002)),
}

logger = logging.getLogger(__name__)


def calculate(
    duration_ms: int, requests_millions: int, concurrency: int, ram_gb: float
) -> float:
    """Calculate the total cost of execution."""

    total_requests = requests_millions * 1_000_000
    total_compute_sec = total_requests * duration_ms * 0.001
    total_compute_gb_sec = ram_gb * total_compute_sec

    logger.debug(
        f"Requests: {total_requests}, Compute (sec): {total_compute_sec}, Compute (GB-s): {total_compute_gb_sec}"
    )

    # Deduct free tier
    billable_compute_gb_sec = max(
        total_compute_gb_sec - COST_FACTORS["free_tier_duration"], 0
    )
    compute_cost = billable_compute_gb_sec * COST_FACTORS["duration"]

    logger.debug(
        f"Billable Compute (GB-s): {billable_compute_gb_sec}, Compute Cost: {compute_cost}"
    )

    # Requests cost
    billable_requests = max(total_requests - COST_FACTORS["free_tier_requests"], 0)
    request_cost = billable_requests * COST_FACTORS["request_cost_per_unit"]

    logger.debug(
        f"Billable Requests: {billable_requests}, Request Cost: {request_cost}"
    )

    total_cost = compute_cost + request_cost
    logger.info(f"Total monthly cost: {total_cost:.6f} USD")
    return total_cost