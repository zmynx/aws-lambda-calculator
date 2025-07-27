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
        region = event.get("region")
        architecture = event.get("architecture")
        number_of_requests = event.get("number_of_requests")
        request_unit = event.get("request_unit")
        duration_of_each_request_in_ms = event.get("duration_of_each_request_in_ms")
        memory = event.get("memory")
        memory_unit = event.get("memory_unit")
        ephemeral_storage = event.get("ephemeral_storage")
        storage_unit = event.get("storage_unit")

        logger.info("Calculating cost...")
        cost = calculate(
            region=region,
            architecture=architecture,
            number_of_requests=number_of_requests,
            request_unit=request_unit,
            duration_of_each_request_in_ms=duration_of_each_request_in_ms,
            memory=memory,
            memory_unit=memory_unit,
            ephemeral_storage=ephemeral_storage,
            storage_unit=storage_unit,
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
