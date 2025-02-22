# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.13.0
FROM python:${PYTHON_VERSION}-slim as base

# Prevents Python from writing pyc files.
ENV PYTHONDONTWRITEBYTECODE=1

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.cache/pip to speed up subsequent builds.
# Leverage a bind mount to requirements.txt to avoid having to copy them into
# into this layer.
# RUN --mount=type=cache,target=/root/.cache/pip \
#     --mount=type=bind,source=requirements.txt,target=requirements.txt \
#     python -m pip install -r requirements.txt

WORKDIR /app

# Install dependencies
ADD requirements.txt .
RUN python -m pip install --upgrade pip && \
	python -m pip install -r requirements.txt

# Create a non-privileged user that the app will run under.
# See https://docs.docker.com/go/dockerfile-user-best-practices/
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

# Switch to the non-privileged user to run the application.
USER appuser

# Add the source code into the container.
ADD src/main.py .

# Run the application.
CMD python ./main.py

MAINTAINER lior.dux@develeap.com
MAINTAINER @zMynxx

LABEL project="aws-lambda-calculator"
LABEL org="zmynx"
LABEL commit-sha="123456789010"
LABEL version="1.0"
LABEL org.opencontainers.image.source="https://github.com/zmynx/aws-lambda-calculator"
LABEL org.opencontainers.image.description="AWS Lambda Calculator is the only extensive and thorugh cost estimation tool for the AWS Lambda product. In it's based, a simple API that produces a cost estimation based on different lambda configurations variables and parameters suchs as CPU, RAM, conncurrency, invokations, free tier and much more. This can be a helpful to for any FinOps fields or tools in the future."
LABEL org.opencontainers.image.licenses="Apache-2.0"

