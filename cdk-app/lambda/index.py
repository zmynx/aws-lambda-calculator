import json
from aws_lambda_calculator import *

def lambda_handler(event, context):
    print("Request:", json.dumps(event, indent=2))
    run()
    return {
        "statusCode": 200,
        "body": json.dumps("Hello from Python Lambda Container!"),
    }
