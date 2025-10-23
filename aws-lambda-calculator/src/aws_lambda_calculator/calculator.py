import os
from dotenv import load_dotenv
import logging
import json
from .models import CalculationRequest, CalculationResult
from typing import Literal, Any

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)


def open_json_file(region: str) -> dict[str, Any]:
    """Open a JSON file containing cost factors for a specific region."""
    base_dir = os.path.dirname(__file__)
    file_path = os.path.join(base_dir, "jsons", f"{region}.json")
    if not os.path.exists(file_path):
        logger.error(f"Cost factors file for region '{region}' not found.")
        return {}

    with open(file_path, "r") as file:
        data = json.load(file)
        logger.debug(f"Loaded cost factors for region '{region}': {data}")
        return data


def unit_conversion_requests(
    number_of_requests: int, request_unit: str, steps: list[str]
) -> int:
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
            steps.append(
                f"Number of requests: {number_of_requests} per second * (60 seconds in a minute * 60 minutes in an hour * 730 hours in a month) = {number_of_requests * (60 * 60 * 730)} per month"
            )
            return int(number_of_requests * (60 * 60 * 730))
        case "per minute":
            logger.debug(
                f"Number of requests: {number_of_requests} per minute * (60 minutes in an hour * 730 hours in a month) = {int(number_of_requests * (60 * 730))} per month"
            )
            steps.append(
                f"Number of requests: {number_of_requests} per minute * (60 minutes in an hour * 730 hours in a month) = {int(number_of_requests * (60 * 730))} per month"
            )
            return int(number_of_requests * (60 * 730))
        case "per hour":
            logger.debug(
                f"Number of requests: {number_of_requests} per hour * (730 hours in a month) = {int(number_of_requests * 730)} per month"
            )
            steps.append(
                f"Number of requests: {number_of_requests} per hour * (730 hours in a month) = {int(number_of_requests * 730)} per month"
            )
            return int(number_of_requests * (730))
        case "per day":
            logger.debug(
                f"Number of requests: {number_of_requests} per day * (730 hours in a month / 24 hours in a day) = {int(number_of_requests * (730 / 24))} per month"
            )
            steps.append(
                f"Number of requests: {number_of_requests} per day * (730 hours in a month / 24 hours in a day) = {int(number_of_requests * (730 / 24))} per month"
            )
            return int(number_of_requests * (730 / 24))
        case "per month":
            logger.debug(f"Number of requests: {int(number_of_requests)} per month")
            steps.append(f"Number of requests: {int(number_of_requests)} per month")
            return int(number_of_requests)
        case "million per month":
            logger.debug(
                f"Number of requests: {number_of_requests} million per month * 1,000,000 multiplier = {int(number_of_requests * 1000000)} per month"
            )
            steps.append(
                f"Number of requests: {number_of_requests} million per month * 1,000,000 multiplier = {int(number_of_requests * 1000000)} per month"
            )
            return int(number_of_requests * 1000000)
        case _:
            raise ValueError(f"Unknown request unit: {request_unit}")


def unit_conversion_memory(memory: float, memory_unit: str, steps: list[str]) -> float:
    """
    @brief Convert memory based on the unit provided.
    @param memory: amount of memory.
    @param memory_unit: per MB, per GB.
    @return: The memory in GB.
    """
    match memory_unit:
        case "MB":
            logger.debug(
                f"Amount of memory allocated: {memory} MB * 0.0009765625 GB in MB = {memory * 0.0009765625} GB"
            )
            steps.append(
                f"Amount of memory allocated: {memory} MB * 0.0009765625 GB in MB = {memory * 0.0009765625} GB"
            )
            return memory * 0.0009765625
        case "GB":
            return memory
        case _:
            raise ValueError(f"Unknown memory unit: {memory_unit}")


def unit_conversion_ephemeral_storage(
    ephemeral_storage_mb: float, storage_unit: str, steps: list[str]
) -> float:
    """
    @brief Convert ephemeral storage based on the unit provided.
    @param ephemeral_storage_mb: The ephemeral storage in MB.
    @param storage_unit: per MB, per GB.
    @return: The ephemeral storage in GB.
    """
    match storage_unit:
        case "MB":
            logger.debug(
                f"Amount of ephemeral storage allocated: {ephemeral_storage_mb} MB * 0.0009765625 GB in MB = {ephemeral_storage_mb * 0.0009765625} GB"
            )
            steps.append(
                f"Amount of ephemeral storage allocated: {ephemeral_storage_mb} MB * 0.0009765625 GB in MB = {ephemeral_storage_mb * 0.0009765625} GB"
            )
            return ephemeral_storage_mb * 0.0009765625
        case "GB":
            return ephemeral_storage_mb
        case _:
            raise ValueError(f"Unknown storage unit: {storage_unit}")


def calculate_tiered_cost(
    total_compute_gb_sec: float,
    tier_cost_factor: dict[str, float],
    overflow_rate: float,
    steps: list[str],
) -> float:
    """
    total_compute_gb_sec: total usage in GB‑seconds
    tier_cost_factor: maps breakpoint (as string) → rate
    overflow_rate: per‑GB‑sec rate for usage beyond the highest breakpoint
    """
    # 1) parse & sort tiers by threshold (ascending)
    tiers = sorted(
        (int(thresh), float(rate)) for thresh, rate in tier_cost_factor.items()
    )

    total_cost = 0.0
    prev_threshold = 0.0

    # 2) bill each tier up to its cap
    for threshold, rate in tiers:
        # how much usage falls into this slice?
        usage_in_tier = min(total_compute_gb_sec, threshold) - prev_threshold
        if usage_in_tier > 0:
            total_cost += usage_in_tier * rate
            prev_threshold += usage_in_tier
        logger.debug(
            f"{usage_in_tier} GB-s x {rate:.8f} USD = {usage_in_tier * rate} USD"
        )
        steps.append(
            f"{usage_in_tier} GB-s x {rate:.8f} USD = {usage_in_tier * rate} USD"
        )

        # once we've billed all the usage, early exit
        if total_compute_gb_sec <= threshold:
            logger.debug(f"Total tier cost: {total_cost} USD (Monthly compute charges)")
            steps.append(f"Total tier cost: {total_cost} USD (Monthly compute charges)")
            return total_cost

    # 3) bill any remaining usage above the highest threshold
    remaining = total_compute_gb_sec - prev_threshold
    if remaining > 0:
        logger.debug(
            f"{remaining} GB-s x {overflow_rate:.8f} USD = {remaining * overflow_rate} USD"
        )
        steps.append(
            f"{remaining} GB-s x {overflow_rate:.8f} USD = {remaining * overflow_rate} USD"
        )
        total_cost += remaining * overflow_rate

    logger.debug(f"Total tier cost: {total_cost} USD (Monthly compute charges)")
    steps.append(f"Total tier cost: {total_cost} USD (Monthly compute charges)")
    return total_cost


def calc_monthly_compute_charges(
    requests_per_month: int,
    duration_of_each_request_in_ms: int,
    memory_in_gb: float,
    tier_cost_factor: dict[str, float],
    include_free_tier: bool,
    steps: list[str],
) -> tuple[float, float]:
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
    steps.append(
        f"{requests_per_month} requests x {duration_of_each_request_in_ms} ms x 0.001 ms to sec conversion factor = {total_compute_sec} total compute (seconds)"
    )

    total_compute_gb_sec = memory_in_gb * total_compute_sec
    logger.debug(
        f"{memory_in_gb} GB x {total_compute_sec} seconds = {total_compute_gb_sec} total compute (GB-s)"
    )
    steps.append(
        f"{memory_in_gb} GB x {total_compute_sec} seconds = {total_compute_gb_sec} total compute (GB-s)"
    )

    ## Apply free tier for compute if enabled
    billable_compute_gb_sec = total_compute_gb_sec
    if include_free_tier:
        free_compute_gb_sec = 400_000  # 400,000 GB-seconds per month
        billable_compute_gb_sec = max(0.0, total_compute_gb_sec - free_compute_gb_sec)
        steps.append(
            f"{total_compute_gb_sec} GB-s - {free_compute_gb_sec} free tier GB-s = {billable_compute_gb_sec} billable GB-s"
        )
        logger.debug(
            f"{total_compute_gb_sec} GB-s - {free_compute_gb_sec} free tier GB-s = {billable_compute_gb_sec} billable GB-s"
        )

    ## Tiered price for billable compute GB-seconds
    logger.debug(f"Tiered price for: {billable_compute_gb_sec} GB-s")
    steps.append(f"Tiered price for: {billable_compute_gb_sec} GB-s")

    # anything above 15 B GB‑sec
    overflow_rate = 0.0000133334
    monthly_compute_charges = calculate_tiered_cost(
        billable_compute_gb_sec, tier_cost_factor, overflow_rate, steps
    )
    return total_compute_gb_sec, monthly_compute_charges, total_compute_sec


def calc_monthly_request_charges(
    requests_per_month: float,
    requests_cost_factor: float,
    include_free_tier: bool,
    steps: list[str],
) -> float:
    billable_requests = requests_per_month
    if include_free_tier:
        free_requests = 1_000_000  # 1 million free requests per month
        billable_requests = max(0, requests_per_month - free_requests)
        steps.append(
            f"{requests_per_month} requests - {free_requests} free tier requests = {billable_requests} monthly billable requests"
        )
        logger.debug(
            f"{requests_per_month} requests - {free_requests} free tier requests = {billable_requests} monthly billable requests"
        )

    res = float(billable_requests) * float(requests_cost_factor)
    if res > 0.0:
        logger.debug(
            f"{billable_requests} requests x {requests_cost_factor:.8f} USD = {res} USD (monthly request charges)"
        )
        steps.append(
            f"{billable_requests} requests x {requests_cost_factor:.8f} USD = {res} USD (monthly request charges)"
        )
    return res


def calc_monthly_ephemeral_storage_charges(
    storage_in_gb: float,
    ephemeral_storage_cost_factor: float,
    total_compute_sec: float,
    steps: list[str],
) -> float:
    billable_storage = max(0.0, float(storage_in_gb) - 0.5)
    gb_s = billable_storage * total_compute_sec
    res = billable_storage * float(ephemeral_storage_cost_factor) * total_compute_sec
    logger.debug(
        f"{storage_in_gb} GB - 0.5 GB (no additional charges) = {billable_storage} GB (billable ephemeral storage)"
    )
    steps.append(
        f"{storage_in_gb} GB - 0.5 GB (no additional charges) = {billable_storage} GB (billable ephemeral storage)"
    )
    if billable_storage > 0.0:
        logger.debug(
            f"{billable_storage} GB x{total_compute_sec} seconds = {gb_s} total storage (GB-s)"
        )
        logger.debug(
            f"{gb_s} GB x {ephemeral_storage_cost_factor:.8f} USD = {res} USD (monthly ephemeral storage charges)"
        )
        steps.append(
            f"{billable_storage} GB x{total_compute_sec} seconds = {gb_s} total storage (GB-s)"
        )
        steps.append(
            f"{gb_s} GB x {ephemeral_storage_cost_factor:.8f} USD = {res} USD (monthly ephemeral storage charges)"
        )
    return res


# Flow:
#
# 1. Detect the correct region
# 2. Open the corresponding config file for region from step 1
# 3. Extract the cost factores (pricing) from the config file:
#   3.1 architecture (x86, arm)
#   3.2 memory
#   3.3 ephemeral storage
# 4. Run unit conversions on the user's input:
#   4.1 unit_conversion_requests on @number of requests, @request unit to convert it to requests per month.
#   4.2 unit_conversion_memory on @memory, @memory unit to convert it to memory in GB.
#   4.3 unit_conversion_ephemeral_storage on @ephemeral storage, @storage unit to convert it to ephemeral storage in GB.
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
    architecture: Literal["x86", "arm64"] = "x86",
    number_of_requests: int = 1000000,
    request_unit: Literal[
        "per second",
        "per minute",
        "per hour",
        "per day",
        "per month",
        "million per month",
    ] = "per day",
    duration_of_each_request_in_ms: int = 1500,
    memory: float = 128,
    memory_unit: Literal["MB", "GB"] = "MB",
    ephemeral_storage: float = 512,
    storage_unit: Literal["MB", "GB"] = "MB",
    include_free_tier: bool = True,
) -> CalculationResult:
    """Calculate the total cost of execution."""

    # Validate inputs using pydantic
    CalculationRequest(
        region=region,
        architecture=architecture,
        number_of_requests=number_of_requests,
        request_unit=request_unit,
        duration_of_each_request_in_ms=duration_of_each_request_in_ms,
        memory=memory,
        memory_unit=memory_unit,
        ephemeral_storage=ephemeral_storage,
        storage_unit=storage_unit,
        include_free_tier=include_free_tier,
    )

    steps: list[str] = []

    logger.info("Starting cost calculation...")

    # Step 2
    cost_factors: dict = open_json_file(region)

    # Step 3
    requests_cost_factor = float(cost_factors.get("Requests", 0.0))
    ephemeral_storage_cost_factor = float(cost_factors.get("EphemeralStorage", 0.0))
    arch_config: dict = cost_factors.get(architecture, {})
    if arch_config is None:
        raise ValueError(f"Unknown architecture: {architecture}")

    # memory_cost_factor = arch_config.get("Memory")
    tier_cost_factor: dict = arch_config.get("Tier", {})

    # Step 4
    if request_unit != "per month" or memory_unit != "GB" or storage_unit != "GB":
        logger.debug("Unit conversions:")
        steps.append("\nUnit conversions:")
    requests_per_month = unit_conversion_requests(
        number_of_requests, request_unit, steps
    )
    memory_in_gb = unit_conversion_memory(memory, memory_unit, steps)
    storage_in_gb = unit_conversion_ephemeral_storage(
        ephemeral_storage, storage_unit, steps
    )

    # Step 5
    logger.debug("Pricing calculations:")
    steps.append("\nPricing calculations:")
    total_compute_gb_sec, monthly_compute_charges, total_compute_sec = calc_monthly_compute_charges(
        requests_per_month,
        duration_of_each_request_in_ms,
        memory_in_gb,
        tier_cost_factor,
        include_free_tier,
        steps,
    )
    logger.debug(f"Monthly compute charges: {monthly_compute_charges} USD")
    steps.append(f"Monthly compute charges: {monthly_compute_charges} USD\n")
    monthly_request_charges = calc_monthly_request_charges(
        requests_per_month, requests_cost_factor, include_free_tier, steps
    )
    logger.debug(f"Monthly request charges: {monthly_request_charges} USD")
    steps.append(f"Monthly request charges: {monthly_request_charges} USD\n")
    monthly_ephemeral_storage_charges = calc_monthly_ephemeral_storage_charges(
        storage_in_gb, ephemeral_storage_cost_factor, total_compute_sec, steps
    )
    logger.debug(
        f"Monthly ephemeral storage charges: {monthly_ephemeral_storage_charges} USD"
    )
    steps.append(
        f"Monthly ephemeral storage charges: {monthly_ephemeral_storage_charges} USD\n"
    )

    # Step 6
    total = (
        monthly_compute_charges
        + monthly_request_charges
        + monthly_ephemeral_storage_charges
    )
    logger.debug(
        f"{monthly_compute_charges} USD + {monthly_request_charges} USD + {monthly_ephemeral_storage_charges} USD = {total} USD"
    )
    steps.append(
        f"{monthly_compute_charges} USD + {monthly_request_charges} USD + {monthly_ephemeral_storage_charges} USD = {total} USD\n"
    )
    logger.debug(f"Lambda cost (monthly): {total} USD")
    steps.append(f"Lambda cost (monthly): {total} USD")

    return CalculationResult(total_cost=total, calculation_steps=steps)
