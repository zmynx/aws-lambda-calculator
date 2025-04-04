import json
from logger import logger


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
        # Extracting data (modify as per your use case)
        name = event.get("name", "Guest")
        age = event.get("age")
        country = event.get("country", "Unknown")

        # Log extracted values
        logger.info(f"Processing user: Name={name}, Age={age}, Country={country}")

        if not age:
            raise ValueError("Missing required field: age")

        # Example response
        response = {
            "status": "success",
            "message": f"Hello {name} from {country}, age {age}!",
        }

        logger.info("Lambda execution completed successfully.")
        return response

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return {"status": "error", "message": str(e)}
