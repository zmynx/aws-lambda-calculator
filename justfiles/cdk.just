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
