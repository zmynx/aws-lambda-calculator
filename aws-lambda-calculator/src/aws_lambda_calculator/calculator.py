import os
from dotenv import load_dotenv
import logging
import json

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

def open_json_file(region: str) -> dict:
    """Open a JSON file containing cost factors for a specific region."""
    file_path = os.path.join("jsons", f"{region}.json")
    if not os.path.exists(file_path):
        logger.error(f"Cost factors file for region '{region}' not found.")
        return {}

    with open(file_path, "r") as file:
        data = json.load(file)
        logger.debug(f"Loaded cost factors for region '{region}': {data}")
        return data


def unit_convertion_requests(number_of_requests: int, request_unit: str) -> float:
    """
        @brief Convert number of requests based on the unit provided. Assuming 730 hours in a month (30 days). Assuming 24 hours in a day.
        @param number_of_requests: The number of requests to convert.
        @param request_unit: per second, per minute, per hour, per day, per month, million per month.
        @return: The number of requests per month.
    """
    match request_unit:
        case "per second":
            return number_of_requests * (60 * 60 * 730)
            logger.debug(f"Number of requests: {number_of_requests} per second * (60 seconds in a minute * 60 minutes in an hour * 730 hours in a month) = {number_of_requests * (60 * 60 * 730)} per month")
        case "per minute":
            return number_of_requests * (60 * 730)
            logger.debug(f"Number of requests: {number_of_requests} per minute * (60 minutes in an hour * 730 hours in a month) = {number_of_requests * (60 * 730)} per month")
        case "per hour":
            return number_of_requests * (730)
            logger.debug(f"Number of requests: {number_of_requests} per hour * (730 hours in a month) = {number_of_requests * 730} per month")
        case "per day":
            return number_of_requests * (730 / 24)
            logger.debug(f"Number of requests: {number_of_requests} per day * (730 hours in a month / 24 hours in a day) = {number_of_requests * (730 / 24)} per month")
        case "per month":
            return number_of_requests
        case "million per month":
            return number_of_requests * 1_000_000
            logger.debug(f"Number of requests: {number_of_requests} million per month * 1,000,000 multiplier = {number_of_requests * 1_000_000} per month")
        case _:
            raise ValueError(f"Unknown request unit: {request_unit}")


def unit_convertion_memory(memory: int, memory_unit: str) -> float:
    """
        @brief Convert memory based on the unit provided.
        @param memory: amount of memory. 
        @param memory_unit: per MB, per GB.
        @return: The memory in GB.
    """
    match memory_unit:
        case "MB":
            return memory *  0.0009765625 
            logger.debug(f"Amount of memory allocated: {memory} MB * 0.0009765625 GB in MB = {memory * 0.0009765625} GB")
        case "GB":
            return memory
        case _:
            raise ValueError(f"Unknown memory unit: {memory_unit}")


def unit_convertion_ephemeral_storage(ephemeral_storage_mb: int, storage_unit: str) -> float:
    """
        @brief Convert ephemeral storage based on the unit provided.
        @param ephemeral_storage_mb: The ephemeral storage in MB.
        @param storage_unit: per MB, per GB.
        @return: The ephemeral storage in GB.
    """
    match storage_unit:
        case "per MB":
            return ephemeral_storage_mb * 0.0009765625
            logger.debug(f"Amount of ephemeral storage allocated: {ephemeral_storage_mb} MB * 0.0009765625 GB in MB = {ephemeral_storage_mb * 0.0009765625} GB")
        case "per GB":
            return ephemeral_storage_mb
        case _:
            raise ValueError(f"Unknown storage unit: {storage_unit}")


def calculate_service_settings(architecture: str, number_of_requests: int, request_unit: str, duration_of_each_request_in_ms: int, memory: int, memory_unit: str, ephemeral_storage: int, storage_unit) -> int:
    # Unit conversions
    requests_per_month = unit_convertion_requests(number_of_requests, request_unit)
    memory_in_gb = unit_convertion_memory(memory, memory_unit)
    storage_in_gb = unit_convertion_ephemeral_storage(ephemeral_storage, storage_unit)

    # Pricing calculations
    total_compute_sec = requests_per_month * 100 ms * 0.001
    logger.debug(f"{requests_per_month} requests x 100 ms x 0.001 ms to sec conversion factor = 1,000,000,000.00 total compute (seconds)")
    total_compute_gb_sec = memory_in_gb * total_compute_sec
    logger.debug(f"{memory_in_gb} x {total_compute_sec} seconds = {memory_in_gb * total_compute_sec} total compute (GB-s)")
    logger.debug(f"Tiered price for: {total_compute_gb_sec} GB-s")

    monthly_compute_charges = total_compute_gb_sec * 0.0000166667
    logger.debug(f"{total_compute_gb_sec} GB-s x 0.0000166667 USD = {monthly_compute_charges} USD")
    logger.debug(f"Total tier cost = {monthly_compute_charges} USD (monthly compute charges)")

    monthly_request_charges = requests_per_month * 0.0000002
    logger.debug(f"Monthly request charges: {requests_per_month} requests * 0.0000002 = {requests_per_month * 0.0000002}")

    storage = storage_in_gb - 0.5  # Assuming 0.5 GB free tier for storage
    total_storage_gb_sec = storage * total_duration_sec
    monthly_ephemeral_storage_charges = total_storage_gb_sec * 0.0000000309

    lambda_cost_monthly = monthly_compute_charges + monthly_request_charges + monthly_ephemeral_storage_charges
    return lambda_cost_monthly

def calculate_duration_cost(duration_ms: int, ram_gb: float) -> float:
    """Calculate the cost based on duration and RAM usage."""
    duration_sec = duration_ms * 0.001
    compute_cost = duration_sec * ram_gb * COST_FACTORS["duration"]
    logger.debug(
        f"Duration (sec): {duration_sec}, RAM (GB): {ram_gb}, Compute Cost: {compute_cost}"
    )
    return compute_cost

def calculate(
    architecture: str = "x86", number_of_requests: int, request_unit: str = "per day", duration_of_each_request_in_ms: int, memory_mb: int = 128, ephemeral_storage_mb: int = 128, duration_ms: int, requests_millions: int, concurrency: int, ram_gb: float
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
