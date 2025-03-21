import json

def lambda_handler(event, context):
    print("Request:", json.dumps(event, indent=2))
    return {
        "statusCode": 200,
        "body": json.dumps("Hello from Python Lambda Container!"),
    }
