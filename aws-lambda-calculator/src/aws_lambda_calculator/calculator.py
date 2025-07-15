import os
from dotenv import load_dotenv
import logging
import json

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)


def open_json_file(region: str) -> dict:
    """Open a JSON file containing cost factors for a specific region."""
    base_dir = os.path.dirname(__file__)
    file_path = os.path.join(base_dir, "jsons", f"{region}.json")
    print(f"[DEBUG] Current working directory: {os.getcwd()}")
    print(f"[DEBUG] Looking for file at: {file_path}")
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
            logger.debug(
                f"Number of requests: {number_of_requests} per second * (60 seconds in a minute * 60 minutes in an hour * 730 hours in a month) = {number_of_requests * (60 * 60 * 730)} per month"
            )
            return number_of_requests * (60 * 60 * 730)
        case "per minute":
            return number_of_requests * (60 * 730)
            logger.debug(
                f"Number of requests: {number_of_requests} per minute * (60 minutes in an hour * 730 hours in a month) = {number_of_requests * (60 * 730)} per month"
            )
        case "per hour":
            return number_of_requests * (730)
            logger.debug(
                f"Number of requests: {number_of_requests} per hour * (730 hours in a month) = {number_of_requests * 730} per month"
            )
        case "per day":
            return number_of_requests * (730 / 24)
            logger.debug(
                f"Number of requests: {number_of_requests} per day * (730 hours in a month / 24 hours in a day) = {number_of_requests * (730 / 24)} per month"
            )
        case "per month":
            return number_of_requests
        case "million per month":
            return number_of_requests * 1000000
            logger.debug(
                f"Number of requests: {number_of_requests} million per month * 1,000,000 multiplier = {number_of_requests * 1000000} per month"
            )
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
            return memory * 0.0009765625
            logger.debug(
                f"Amount of memory allocated: {memory} MB * 0.0009765625 GB in MB = {memory * 0.0009765625} GB"
            )
        case "GB":
            return memory
        case _:
            raise ValueError(f"Unknown memory unit: {memory_unit}")


def unit_convertion_ephemeral_storage(
    ephemeral_storage_mb: int, storage_unit: str
) -> float:
    """
    @brief Convert ephemeral storage based on the unit provided.
    @param ephemeral_storage_mb: The ephemeral storage in MB.
    @param storage_unit: per MB, per GB.
    @return: The ephemeral storage in GB.
    """
    match storage_unit:
        case "per MB":
            return ephemeral_storage_mb * 0.0009765625
            logger.debug(
                f"Amount of ephemeral storage allocated: {ephemeral_storage_mb} MB * 0.0009765625 GB in MB = {ephemeral_storage_mb * 0.0009765625} GB"
            )
        case "per GB":
            return ephemeral_storage_mb
        case _:
            raise ValueError(f"Unknown storage unit: {storage_unit}")


def calculate_tiered_cost(total_compute_gb_sec: float, tier_cost_factor: dict) -> float:
    """
    Calculate the total cost for a given compute usage, based on tiered pricing.
    """
    # Convert string keys/values to sorted list of (int threshold, float rate)
    tiers = sorted(
        (int(thresh), float(rate)) for thresh, rate in tier_cost_factor.items()
    )

    total_cost = 0.0
    previous_threshold = 0

    for threshold, rate in tiers:
        # Determine units in this tier
        if total_compute_gb_sec > threshold:
            tier_units = threshold - previous_threshold
        else:
            tier_units = total_compute_gb_sec - previous_threshold

        # Calculate and accumulate cost
        if tier_units > 0:
            total_cost += tier_units * rate
            previous_threshold += tier_units

        # Stop if we've billed all usage
        if total_compute_gb_sec <= threshold:
            break

    return total_cost


def calc_monthly_compute_charges(
    requests_per_month: int,
    duration_of_each_request_in_ms: int,
    memory_in_gb: float,
    tier_cost_factor: dict,
) -> float:
    """
    @brief Calculate the monthly compute charges based on requests per month, duration of each request in ms, and memory in GB.
    @param requests_per_month: The number of requests per month.
    @param duration_of_each_request_in_ms: The duration of each request in milliseconds.
    @param memory_in_gb: The amount of memory allocated in GB.
    @return: The monthly compute charges.
    """
    total_compute_sec = requests_per_month * (duration_of_each_request_in_ms * 0.001)
    logger.debug(
        f"{requests_per_month} requests x {duration_of_each_request_in_ms} ms x 0.001 ms to sec conversion factor = {total_compute_sec} total compute (seconds)"
    )

    total_compute_gb_sec = memory_in_gb * total_compute_sec
    logger.debug(
        f"{memory_in_gb} GB x {total_compute_sec} seconds = {total_compute_gb_sec} total compute (GB-s)"
    )

    ## Tiered price for total compute GB-seconds
    logger.debug(f"Tiered price for: {total_compute_gb_sec} GB-s")

    monthly_compute_charges = calculate_tiered_cost(
        total_compute_gb_sec, tier_cost_factor
    )
    return monthly_compute_charges


def calc_monthly_request_charges(
    requests_per_month: int, requests_cost_factor: float
) -> float:
    return requests_per_month * requests_cost_factor


def calc_monthly_ephemeral_storage_charges(
    storage_in_gb: int, ephemeral_storage_cost_factor: float
) -> float:
    return storage_in_gb * ephemeral_storage_cost_factor


# Flow:
#
# 1. Detect the correct region
# 2. Open the corresponding config file for region from step 1
# 3. Extract the cost factores (pricing) from the config file:
#   3.1 architecture (x86, arm)
#   3.2 memory
#   3.3 ephemeral storage
# 4. Run unit convertions on the user's input:
#   4.1 unit_convertion_requests on @number of requests, @request unit to convert it to requests per month.
#   4.2 unit_convertion_memory on @memory, @memory unit to convert it to memory in GB.
#   4.3 unit_convertion_ephemeral_storage on @ephemeral storage, @storage unit to convert it to ephemeral storage in GB.
# 5. Pricing calculations:
#
#   ## Monthly Compute Charges
#   5.1 Calculate total compute seconds based on requests per month and duration of each request in ms.
#   5.2 Calculate total compute GB-seconds based on memory in GB and total compute seconds.
#   5.3 Calculate tiered price for total compute GB-seconds using the cost factor from the config file.
#   5.4 Calculate monthly compute charges based step 5.3.
#
#   ## Monthly Request Charges
#   5.5 Calculate monthly request charges based on requests per month and the cost factor from the config file.
#
#  ## Monthly Ephemeral Storage Charges
#   5.6 Calculate total storage GB-seconds based on ephemeral storage in GB and total duration seconds.
#
# 6. Calculate the total monthly cost by summing up the monthly compute charges, monthly request charges, and monthly ephemeral storage charges.
def calculate(
    region: str = "us-east-1",
    architecture: str = "x86",
    number_of_requests: int = 1000000,
    request_unit: str = "per day",
    duration_of_each_request_in_ms: int = 1500,
    memory: int = 128,
    memory_unit: str = "MB",
    ephemeral_storage: int = 128,
    storage_unit: str = "MB",
    duration_ms: int = 1,
) -> float:
    """Calculate the total cost of execution."""

    logger.info("Starting cost calculation...")

    # Step 2
    cost_factors = open_json_file(region)

    # Step 3
    requests_cost_factor = cost_factors.get("Requests")
    ephemeral_storage_cost_factor = cost_factors.get("EphemeralStorage")
    arch_config = cost_factors.get(architecture)
    if arch_config is None:
        raise ValueError(f"Unknown architecture: {architecture}")

    memory_cost_factor = arch_config.get("Memory")
    tier_cost_factor = arch_config.get("Tier")

    # Step 4
    requests_per_month = unit_convertion_requests(number_of_requests, request_unit)
    memory_in_gb = unit_convertion_memory(memory, memory_unit)
    storage_in_gb = unit_convertion_ephemeral_storage(ephemeral_storage, storage_unit)

    # Step 5
    monthly_compute_charges = calc_monthly_compute_charges(
        requests_per_month,
        duration_of_each_request_in_ms,
        memory_in_gb,
        tier_cost_factor,
    )
    monthly_request_charges = calc_monthly_request_charges(
        requests_per_month, requests_cost_factor
    )
    monthly_ephemeral_storage_charges = calc_monthly_ephemeral_storage_charges(
        storage_in_gb, ephemeral_storage_cost_factor
    )

    # Step 6
    total = (
        monthly_compute_charges
        + monthly_request_charges
        + monthly_ephemeral_storage_charges
    )
    return total
