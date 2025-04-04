# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.13.0

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

# Update system, install git
RUN apt-get update --yes &&\
	apt-get install git --yes

# Prepare custom install path
RUN mkdir -p /install

# Install dependencies
COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
	python -m pip install --prefix=/install -r requirements.txt

ARG VERSION=main
ENV VERSION=${VERSION}
# RUN git config --global http.sslverify false
RUN python -m pip install --prefix=/install --no-build-isolation --no-cache-dir aws-lambda-calculator@git+https://github.com/zmynx/aws-lambda-calculator#egg=aws-lambda-calculator&subdirectory=aws-lambda-calculator@"${VERSION}"

# Add the source code into the container.
COPY src/ .

##############################
# Final Stage (Distroless)
##############################
FROM gcr.io/distroless/python3-debian12 as distroless

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

WORKDIR /app

# Copy dependencies and app code from builder
COPY --from=builder /install /usr/local
COPY --from=builder /app/src/cli.py . 

# Run the application.
ENTRYPOINT [ "/usr/local/bin/python"]
CMD [ "cli.py" ]

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD ps aux | grep 'python' | grep -v 'grep' || exit 1


##############################
# Lambda Runtime Base Image
##############################
ARG LAMBDA_PYTHON_VERSION=3.13
FROM public.ecr.aws/lambda/python:${LAMBDA_PYTHON_VERSION} AS lambda_runtime

WORKDIR /var/task

# Copy dependencies and app code from builder
COPY --from=builder /install /usr/local
COPY --from=builder /app/src/aws_lambda.py .

# Lambda expects to find the function handler as an environment variable
CMD [ "aws_lambda.handler" ]
