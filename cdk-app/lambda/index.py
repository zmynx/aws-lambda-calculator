import json
from aws_lambda_calculator import *

def lambda_handler(event, context):
    print("Request:", json.dumps(event, indent=2))
    
    # Extract parameters from event if available
    params = event.get('body', {})
    if isinstance(params, str):
        params = json.loads(params)
        
    result = run(params)
    return {
        "statusCode": 200,
        "body": json.dumps({"result": result}),
    }
