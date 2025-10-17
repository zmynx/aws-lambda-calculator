import argparse
import sys
from utils.logger import logger
from aws_lambda_calculator import calculate
from importlib import metadata

__version__ = metadata.version("aws_lambda_calculator")


def parse_args() -> argparse.Namespace:
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(
        prog=f"aws_lambda_calculator {__version__}",
        usage="%(prog)s [options]",
        description="CLI tool to calculate AWS Lambda costs based on various parameters.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        epilog="Thanks for using the CLI tool! For more information, visit the project repository.",
        add_help=True,
        allow_abbrev=True,
        exit_on_error=True,
    )

    # Required arguments
    parser.add_argument(
        "-r",
        "--region",
        type=str,
        required=True,
        choices=[
            "af-south-1",
            "ap-east-1",
            "ap-east-2",
            "ap-northeast-1",
            "ap-northeast-2",
            "ap-northeast-3",
            "ap-south-1",
            "ap-south-2",
            "ap-southeast-1",
            "ap-southeast-2",
            "ap-southeast-3",
            "ap-southeast-4",
            "ap-southeast-5",
            "ap-southeast-7",
            "ca-central-1",
            "ca-west-1",
            "eu-central-1",
            "eu-central-2",
            "eu-north-1",
            "eu-south-1",
            "eu-south-2",
            "eu-west-1",
            "eu-west-2",
            "eu-west-3",
            "il-central-1",
            "me-central-1",
            "me-south-1",
            "mx-central-1",
            "sa-east-1",
            "us-east-1",
            "us-east-2",
            "us-gov-east-1",
            "us-gov-west-1",
            "us-west-1",
            "us-west-2",
        ],
        help="AWS region code",
    )
    parser.add_argument(
        "-a",
        "--architecture",
        type=str,
        required=True,
        choices=["x86", "arm64"],
        help="Architecture (x86 or arm64)",
    )
    parser.add_argument(
        "-n", "--number-of-requests", type=int, required=True, help="Number of requests"
    )
    parser.add_argument(
        "-nu",
        "--request-unit",
        type=str,
        required=True,
        choices=[
            "per second",
            "per minute",
            "per hour",
            "per day",
            "per month",
            "millions per month",
        ],
        help="Request unit",
    )
    parser.add_argument(
        "-d",
        "--duration-of-each-request-in-ms",
        type=int,
        required=True,
        help="Duration of each request in milliseconds",
    )
    parser.add_argument(
        "-m", "--memory", type=float, required=True, help="Amount of memory"
    )
    parser.add_argument(
        "-mu",
        "--memory-unit",
        type=str,
        required=True,
        choices=["GB", "MB"],
        help="Memory unit (GB or MB)",
    )
    parser.add_argument(
        "-es",
        "--ephemeral-storage",
        type=float,
        required=True,
        help="Amount of ephemeral storage",
    )
    parser.add_argument(
        "-esu",
        "--storage-unit",
        type=str,
        required=True,
        choices=["GB", "MB"],
        help="Storage unit (GB or MB)",
    )

    # Optional verbose flag
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose logging"
    )

    # Version argument
    parser.add_argument(
        "-V",
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
        help="Show the version of the CLI tool",
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
            region=args.region,
            architecture=args.architecture,
            number_of_requests=args.number_of_requests,
            request_unit=args.request_unit,
            duration_of_each_request_in_ms=args.duration_of_each_request_in_ms,
            memory=args.memory,
            memory_unit=args.memory_unit,
            ephemeral_storage=args.ephemeral_storage,
            storage_unit=args.storage_unit,
        )

        logger.info(f"Total cost: {total_cost:.6f} USD")
        logger.info("Execution completed successfully.")
        print(f"Total cost: {total_cost:.6f} USD")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run()
