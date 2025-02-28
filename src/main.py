# import logging
# import aws_lambda_calculator
from aws_lambda_calculator import aws_lambda_calculator


def main() -> None:
    aws_lambda_calculator.run()

if __name__ == "__main__":
    main()
