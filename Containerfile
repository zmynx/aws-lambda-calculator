# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.13.0
FROM python:${PYTHON_VERSION}-slim AS base

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

# Update system, install git
RUN apt-get update --yes &&\
	apt-get install git --yes

# Install dependencies
COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
	python -m pip install -r requirements.txt

ARG VERSION=main
ENV VERSION=${VERSION}
RUN git config --global http.sslverify false
RUN python -m pip install aws-lambda-calculator@git+https://github.com/zmynx/aws-lambda-calculator#egg=aws-lambda-calculator&subdirectory=aws-lambda-calculator@"${VERSION}"

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
COPY src/main.py .

# Run the application.
ENTRYPOINT [ "/usr/local/bin/python" ]
CMD [ "main.py" ]

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD ps aux | grep 'python' | grep -v 'grep' || exit 1
