import argparse
import sys
from logger import logger
from aws_lambda_calculator import *


def parse_args() -> argparse.Namespace:
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(
        description="CLI tool for my application",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # Required arguments
    parser.add_argument(
        "-n", "--name", type=str, required=True, help="Name of the user"
    )
    parser.add_argument("-a", "--age", type=int, required=True, help="Age of the user")
    parser.add_argument(
        "-c", "--country", type=str, required=True, help="Country of the user"
    )

    # Optional verbose flag
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose logging"
    )

    return parser.parse_args()


def main() -> None:
    """Main function to parse arguments and execute my_function."""
    try:
        args = parse_args()

        # Set logging level based on verbose flag
        if args.verbose:
            logger.setLevel("DEBUG")

        logger.info("Starting CLI tool...")
        logger.debug(f"Arguments received: {vars(args)}")

        # Call the function with parsed values
        my_function(name=args.name, age=args.age, country=args.country)

        logger.info("Execution completed successfully.")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
