import os
from dotenv import load_dotenv
from logger import logger

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

    # requests = requests_in_millions * 1000000
    # compute = requests * duration * 0.001
    # # logging.info(
    # #     f"{requests} requests x {duration} ms x 0.001 ms to sec conversion factor = {compute} total compute (seconds)"
    # # )
    # compute_gb = ram * compute
    # # logging.info(f"{ram} GB x {compute} seconds = {compute_gb} total compute (GB-s)")
    # free_tier_gb = free_tier_duration
    # # logging.info(
    # #     f"{compute_gb} GB-s - {free_tier_gb} free tier GB-s = {compute_gb - free_tier_gb} GB-s"
    # # )
    # total_compute_gb = compute_gb - free_tier_gb
    # # logging.info(
    # #     f"Max ({total_compute_gb} GB-s, 0 ) = {max(total_compute_gb, 0)} total billable GB-s"
    # # )
    # tier_cost = max(total_compute_gb, 0) * duration_cost
    # # logging.info(f"Tiered price cost: {tier_cost} USD")
    #
    # total_requests = requests - free_tier_requests
    # # logging.info(
    # #     f"{requests} requests - {free_tier_requests} free tier requests = {total_requests} monthly billable requests"
    # # )
    # total_requests_cost = total_requests * 0.0000002
    # # logging.info(
    # #     f"{total_requests} total monthly billable requests x 0.0000002 USD = {total_requests_cost} USD (monthly request charges)"
    # # )
    # total_cost = tier_cost + total_requests_cost
    # # logging.info(f"Total tier cost = {total_cost} USD (monthly compute charges)")
    #
    # return total_cost
