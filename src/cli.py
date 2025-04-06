import argparse
import sys
from utils.logger import logger
from aws_lambda_calculator import calculate


def parse_args() -> argparse.Namespace:
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(
        description="CLI tool for my application",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # Required arguments
    parser.add_argument(
        "-d", "--duration-ms", type=int, required=True, help="Duration in milliseconds"
    )
    parser.add_argument(
        "-r",
        "--requests-millions",
        type=int,
        required=True,
        help="Requests in millions",
    )
    parser.add_argument(
        "-c", "--concurrency", type=int, required=True, help="Concurrency level"
    )
    parser.add_argument("-m", "--ram-gb", type=float, required=True, help="RAM in GB")

    # Optional verbose flag
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose logging"
    )

    return parser.parse_args()


def run() -> None:
    """Main function to parse arguments and execute calculate."""
    try:
        args = parse_args()

        # Set logging level based on verbose flag
        if args.verbose:
            logger.setLevel("DEBUG")

        logger.info("Starting CLI tool...")
        logger.debug(f"Arguments received: {vars(args)}")

        # Call the calculate function with parsed values
        total_cost = calculate(
            duration_ms=args.duration_ms,
            requests_millions=args.requests_millions,
            concurrency=args.concurrency,
            ram_gb=args.ram_gb,
        )

        print(f"Total cost: {total_cost:.6f} USD")
        logger.info(f"Total cost: {total_cost:.6f} USD")
        logger.info("Execution completed successfully.")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run()
