# Use SAM local to start only the API Gateway
[no-cd]
sam-local-start-api:
    echo "Starting SAM local API..."
    sam local start-api --template serverless/template.yaml --port 3000

# Use SAM local to start only the Lambda functions
[no-cd]
sam-local-start-lambda:
    echo "Starting SAM local Lambda..."
    sam local start-lambda --template serverless/template.yaml --port 3001

# Use SAM local to start a local API Gateway and Lambda environment
[no-cd]
sam-local-start-all: sam-local-start-api sam-local-start-lambda
    echo "Starting SAM local API and Lambda..."

# Use SAM local to invoke the API Gateway endpoint
[no-cd]
sam-local-invoke-api:
    echo "Invoking SAM local API..."
    sam local invoke "AwsLambdaCalculatorApiGateway" -e events/event.json --template serverless/template.yaml

# Use SAM local to invoke the Lambda function
[no-cd]
sam-local-invoke-lambda:
    echo "Invoking SAM local Lambda..."
    sam local invoke "AwsLambdaCalculatorLambdaFunction" -e events/event.json --template serverless/template.yaml

# Use SAM local to invoke the local API Gateway and Lambda environment
[no-cd]
sam-local-invoke-all: sam-local-invoke-api sam-local-invoke-lambda
    echo "Invoking SAM local API and Lambda..."

# Use SAM local to run all
[no-cd]
sam-local-run-all: sam-local-start-all sam-local-invoke-all
    echo "Running SAM local API and Lambda..."
