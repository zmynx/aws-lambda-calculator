# Bootstrap the CDK environment
[no-cd]
cdk-bootstrap:
    echo "Boostrapping CDK..."
    export CDK_DEFAULT_ACCOUNT={{account_id}}
    export CDK_DEFAULT_REGION={{region}}
    cdk bootstrap aws://{{account_id}}/{{region}} \
      --profile {{profile}} \
      --notices false \
      --context env=prod

# Synthesize the CDK application
[no-cd]
cdk-synth:
    echo "Synthesizing CDK..."
    cdk synth \
      --profile {{profile}} \
      --notices false \
      --context env=prod \
      --ci \
      --debug \
      --verbose \
      --output dist

# Deploy the CDK application
[no-cd]
cdk-deploy:
    echo "Deploying CDK..."
    cdk deploy \
      --profile {{profile}} \
      --notices false \
      --context env=prod \
      --app dist \
      --ci \
      --rollback true \
      --progress bar \
      --debug \
      --verbose \
      --require-approval never \
      --outputs-file outputs.json

# Destroy the CDK application
[no-cd]
cdk-destroy:
    echo "Destroying CDK..."
    cdk destroy \
      --profile {{profile}} \
      --notices false \
      --context env=prod \
      --all \
      --force

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
