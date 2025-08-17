# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.13
ARG LAMBDA_PYTHON_VERSION=3.13

##############################
# Builder Stage
##############################
FROM python:${PYTHON_VERSION}-slim AS builder

# Prevents Python from writing pyc files.
ENV PYTHONDONTWRITEBYTECODE=1

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1


WORKDIR /app

# Update system
RUN apt-get update --yes

# Install dependencies
COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
	python -m pip install -r requirements.txt

ARG VERSION=main
ENV VERSION=${VERSION}

RUN python -m pip install "https://github.com/zmynx/aws-lambda-calculator/releases/download/${VERSION}/aws_lambda_calculator-${VERSION}-py3-none-any.whl"

# Add the source code into the container.
COPY src/ .

##############################
# Final Stage (Distroless)
##############################
# FROM gcr.io/distroless/python3-debian12:debug AS distroless
FROM al3xos/python-distroless:${PYTHON_VERSION}-debian12-debug AS distroless

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

WORKDIR /app

# Copy dependencies and app code from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages/ /usr/local/lib/python3.13/site-packages/.
COPY --from=builder /app/utils utils
COPY --from=builder /app/cli.py .

# Run the application.
ENTRYPOINT [ "/usr/local/bin/python"]
CMD [ "cli.py" ]

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD ps aux | grep 'python' | grep -v 'grep' || exit 1


##############################
# Lambda Runtime Base Image
##############################
FROM public.ecr.aws/lambda/python:${LAMBDA_PYTHON_VERSION} AS lambda_runtime

WORKDIR /var/task

# Copy dependencies and app code from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages/ /var/lang/lib/python3.13/site-packages/. 
COPY --from=builder /app/utils utils
COPY --from=builder /app/aws_lambda.py .

# Lambda expects to find the function handler as an environment variable
CMD [ "aws_lambda.handler" ]
