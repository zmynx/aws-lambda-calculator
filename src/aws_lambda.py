import json
from utils.logger import logger
from aws_lambda_calculator import calculate


def handler(event: dict, context: object) -> dict:
    """
    AWS Lambda handler function.
    """
    logger.info("Lambda function invoked.")
    logger.debug(f"Received event: {json.dumps(event, indent=2)}")

    def make_response(status_code: int, payload: dict) -> dict:
        """Helper to format Lambda proxy integration responses with CORS."""
        return {
            "statusCode": status_code,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            "body": json.dumps(payload)
        }

    try:
        payload = json.loads(event.get("body", "{}"))
        region = payload.get("region")
        architecture = payload.get("architecture")
        number_of_requests = payload.get("number_of_requests")
        request_unit = payload.get("request_unit")
        duration_of_each_request_in_ms = payload.get("duration_of_each_request_in_ms")
        memory = payload.get("memory")
        memory_unit = payload.get("memory_unit")
        ephemeral_storage = payload.get("ephemeral_storage")
        storage_unit = payload.get("storage_unit")

        required_params = {
            "region": region,
            "architecture": architecture,
            "number_of_requests": number_of_requests,
            "request_unit": request_unit,
            "duration_of_each_request_in_ms": duration_of_each_request_in_ms,
            "memory": memory,
            "memory_unit": memory_unit,
            "ephemeral_storage": ephemeral_storage,
            "storage_unit": storage_unit,
        }

        for name, value in required_params.items():
            if value is None:
                raise KeyError(name)

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

        return make_response(200, {
            "status": "success",
            "cost": round(cost, 6)
        })

    except KeyError as e:
        logger.error(f"Missing required field: {e}")
        return make_response(400, {
            "status": "error",
            "message": f"Missing required field: {e}"
        })

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return make_response(500, {
            "status": "error",
            "message": str(e)
        })
