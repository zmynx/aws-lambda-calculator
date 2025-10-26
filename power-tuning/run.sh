#!/usr/bin/env bash

PROFILE="zMynx"
REGION="us-east-1"

zip function.zip lambda_function.py

aws iam create-role \
  --role-name lambda-basic-execution \
  --assume-role-policy-document file://trust-policy.json \
  --profile $PROFILE \
  --region $REGION

aws iam attach-role-policy \
  --role-name lambda-basic-execution \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --profile $PROFILE \
  --region $REGION

aws lambda create-function \
  --function-name FibonacciBenchmark \
  --runtime python3.13 \
  --role arn:aws:iam::1234567890:role/lambda-basic-execution \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 120 \
  --profile $PROFILE \
  --region $REGION
