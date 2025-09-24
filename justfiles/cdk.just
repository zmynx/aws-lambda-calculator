# Bootstrap the CDK environment
cdk-bootstrap:
    echo "Boostrapping CDK..."
    cdk bootstrap aws://{{account_id}}/{{region}} --profile {{profile}}

# Synthesize the CDK application
cdk-synth:
    echo "Synthesizing CDK..."
    cdk synth --profile {{profile}}

# Deploy the CDK application
cdk-deploy:
    echo "Deploying CDK..."
    cdk deploy --all --require-approval never --profile {{profile}}

# Destroy the CDK application
cdk-destroy:
    echo "Destroying CDK..."
    cdk destroy --all --force --profile {{profile}}

# Use SAM local to start a local API Gateway and Lambda environment
sam-local-start-all: sam-local-start-api sam-local-start-lambda
    echo "Starting SAM local API and Lambda..."

# Use SAM local to start only the API Gateway
sam-local-start-api:
    echo "Starting SAM local API..."
    sam local start-api --template template.yaml --port 3000

# Use SAM local to start only the Lambda functions
sam-local-start-lambda:
    echo "Starting SAM local Lambda..."
    sam local start-lambda --template template.yaml --port 3001

# Use SAM local to invoke the local API Gateway and Lambda environment
sam-local-invoke-all: sam-local-invoke-api sam-local-invoke-lambda
    echo "Invoking SAM local API and Lambda..."

# Use SAM local to invoke the API Gateway endpoint
sam-local-invoke-api:
    echo "Invoking SAM local API..."
    sam local invoke "AwsLambdaCalculatorApiGateway" -e events/event.json --template template.yaml

# Use SAM local to invoke the Lambda function
sam-local-invoke-lambda:
    echo "Invoking SAM local Lambda..."
    sam local invoke "AwsLambdaCalculatorLambdaFunction" -e events/event.json --template template.yaml

# Use SAM local to run all
sam-local-run-all: sam-local-start-all sam-local-invoke-all
    echo "Running SAM local API and Lambda..."
