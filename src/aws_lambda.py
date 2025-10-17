import json
import os
import logging
from utils.logger import logger
from aws_lambda_calculator import calculate

# Extracting the version from the package metadata
from importlib import metadata
__version__ = metadata.version("aws_lambda_calculator")


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
        
        # Check for verbose flag (default to True as per requirements)
        verbose = payload.get("verbose", True)
        
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

        # Set logger to DEBUG level if verbose mode is enabled
        if verbose:
            calc_logger = logging.getLogger('aws_lambda_calculator')
            calc_logger.setLevel(logging.DEBUG)
            logger.setLevel(logging.DEBUG)

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

        response_data = {
            "status": "success",
            "cost": round(cost, 6)
        }
        
        # If verbose mode, read and include log file content
        if verbose:
            log_file_path = "/tmp/aws_lambda_calculator.log"
            try:
                if os.path.exists(log_file_path):
                    with open(log_file_path, 'r') as log_file:
                        # Get last 100 lines or so to avoid huge responses
                        log_lines = log_file.readlines()
                        recent_logs = log_lines[-100:] if len(log_lines) > 100 else log_lines
                        response_data["verbose_logs"] = ''.join(recent_logs)
            except Exception as e:
                logger.warning(f"Could not read log file: {e}")
                response_data["verbose_logs"] = "Log file not accessible"

        return make_response(200, response_data)

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
