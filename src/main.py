# import logging
from aws_lambda_calculator import *
from logger import logger


def main() -> None:
    logger.info("This is an info log from my_function.")
    logger.warning("This is a warning log from my_function.")
    # run()


if __name__ == "__main__":
    main()
