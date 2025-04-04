import json
from utils.logger import logger
from aws_lambda_calculator import calculate


def handler(event: dict, context: object) -> dict:
    """
    AWS Lambda handler function.

    Args:
        event (dict): The event data passed to the Lambda function.
        context (object): The runtime information provided by AWS Lambda.

    Returns:
        dict: A response dictionary with status and message.
    """
    logger.info("Lambda function invoked.")
    logger.debug(f"Received event: {json.dumps(event, indent=2)}")

    try:
        duration_ms = event["duration_ms"]
        requests_millions = event["requests_millions"]
        concurrency = event["concurrency"]
        ram_gb = event["ram_gb"]

        logger.info("Calculating cost...")
        cost = calculate(
            duration_ms=duration_ms,
            requests_millions=requests_millions,
            concurrency=concurrency,
            ram_gb=ram_gb,
        )

        return {
            "status": "success",
            "cost": round(cost, 6),
        }

    except KeyError as e:
        logger.error(f"Missing required field: {e}")
        return {"status": "error", "message": f"Missing required field: {e}"}
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return {"status": "error", "message": str(e)}
