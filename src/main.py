import logging

# Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

duration_cost = 0.0000166667
milions_requests_cost = 0.20
concurrency_cost = 0.000041667
storage_cost = 0.000000
free_tier_duration = 400000
free_tier_requests = 1000000


def calc_cost(duration: int, requests_in_millions: int, concurrency: int, ram: float):

    requests = requests_in_millions * 1000000
    compute = requests * duration * 0.001
    logging.info(
        f"{requests} requests x {duration} ms x 0.001 ms to sec conversion factor = {compute} total compute (seconds)"
    )
    compute_gb = ram * compute
    logging.info(f"{ram} GB x {compute} seconds = {compute_gb} total compute (GB-s)")
    free_tier_gb = free_tier_duration
    logging.info(
        f"{compute_gb} GB-s - {free_tier_gb} free tier GB-s = {compute_gb - free_tier_gb} GB-s"
    )
    total_compute_gb = compute_gb - free_tier_gb
    logging.info(
        f"Max ({total_compute_gb} GB-s, 0 ) = {max(total_compute_gb, 0)} total billable GB-s"
    )
    tier_cost = max(total_compute_gb, 0) * duration_cost
    logging.info(f"Tiered price cost: {tier_cost} USD")

    total_requests = requests - free_tier_requests
    logging.info(
        f"{requests} requests - {free_tier_requests} free tier requests = {total_requests} monthly billable requests"
    )
    total_requests_cost = total_requests * 0.0000002
    logging.info(
        f"{total_requests} total monthly billable requests x 0.0000002 USD = {total_requests_cost} USD (monthly request charges)"
    )
    total_cost = tier_cost + total_requests_cost
    logging.info(f"Total tier cost = {total_cost} USD (monthly compute charges)")

    return total_cost


if __name__ == "__main__":
    ram = 0.128
    duration = 3000
    requests = 2
    concurrency = 1
    calc_cost(
        duration=duration,
        requests_in_millions=requests,
        concurrency=concurrency,
        ram=ram,
    )
