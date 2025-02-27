#!/usr/bin/env just --justfile

# Set shell for non-Windows OSs:
set shell := ["/bin/bash", "-c"]

## Set the shell for windows users
set windows-powershell := true

# set defaults
bin	    := "main.py"
req_file    := "requirements.txt"
org	    := "zmynx"
repo	    := "aws-lambda-calculator"

####################################################################################################################################################################################
## General recipes
####################################################################################################################################################################################

# Default recipe to display help information
default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose

# Clean cache (optional)
clean:
    echo "Cleaning .pyc files and cache..."
    find . -name "*.pyc" -delete
    find . -name "__pycache__" -delete

# Help command to display available tasks
help:
    echo "Available commands:"
    echo "  just all         - Run all tasks"
    echo "  just run         - Run the Python script"
    echo "  just lint        - Run lint checks with flake8"
    echo "  just type-check  - Run type checks with mypy"
    echo "  just format      - Format code with black"
    echo "  just install     - Install dependencies with Poetry"
    echo "  just check       - Run lint, type-check, and format"
    echo "  just clean       - Clean .pyc files and cache"

####################################################################################################################################################################################
## Poetry
####################################################################################################################################################################################

# Run-all
all: env && clean install checks run

# Set env
env:
    echo "Setting up the environment..."
    pyenv local 3.13.0
    python --version

# Run the Python script
run:
    echo "Running the Python script..."
    python -m poetry run python {{bin}}

lint:
    echo "Running lint checks with Ruff..."
    python -m poetry run ruff format
    python -m poetry run ruff check --fix

# Type check with mypy
type-check:
    echo "Running type checks with mypy..."
    python -m poetry run mypy .

# Format code with black
format:
    echo "Formatting code with black..."
    python -m poetry run black .

# Install dependencies with Poetry
install:
    echo "Installing dependencies with Poetry..."
    python -m pip install --upgrade pip
    python -m pip install poetry
    python -m poetry install

# Generate a requirements.txt file
export:
    echo "Generating requirements.txt file.."
    python -m poetry export --format {{req_file}} --all-groups --without-hashes --output {{req_file}}

# Full check: lint, type-check, and format
checks:
    just lint
    just type-check
    just format

# Create a tarball, wheel, dist from this package
build:
    echo "Building the package..."
    python -m poetry build

# Ugrade the project package version
# ARG can be one of the following patch, minor, major, prepatch, preminor, premajor, prerelease.
version ARG:
    echo "Updating the project package version..."
    python -m poetry version {{ARG}}

####################################################################################################################################################################################
## Podman
####################################################################################################################################################################################

# Build Container using Podman
podman-build:
    echo "Building the container using podman..."
    podman build -f Dockerfile -t ghcr.io/{{org}}/{{repo}}:$(python -m poetry version -s)

# Connect to the GitHub Registery
podman-login:
    podman login ghcr.io --authfile .podman-auth.secret

# Publish image to registery
podman-push: podman-login
    echo "Pusing image to ghcr.io registery"
    podman build -f Dockerfile -t ghcr.io/{{org}}/{{repo}}:$(python -m poetry version -s)

# Build using the compose file
compose-build:
    podman compose build

####################################################################################################################################################################################
## Cosign 
####################################################################################################################################################################################

# Generate key-pair 
cosign-generate:
    echo "Generating key pair using Cosign..."
    cosign generate-key-pair
    # gh auth token | read GITHUB_TOKEN && export GITHUB_TOKEN && cosign generate-key-pair github://{{org}}/{{repo}}
    # unset GITHUB_TOKEN

# Sign 
cosign-sign:
    echo "Signing an image..."
    # cosign sign --yes --key cosign.key ghcr.io/{{org}}/{{repo}}@sha256:d4e2d83c62707e84f69ac39b86f742a06f887ffe52758645dd846d824af4599f
    cosign sign --yes ghcr.io/{{org}}/{{repo}}@sha256:d4e2d83c62707e84f69ac39b86f742a06f887ffe52758645dd846d824af4599f --registry-token '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'
    # cosign sign --key github://{{org}}/{{repo}} ghcr.io/{{org}}/{{repo}}
    # gh auth token | read GITHUB_TOKEN && export GITHUB_TOKEN && cosign sign --key github://{{org}}/{{repo}} ghcr.io/{{org}}/{{repo}}
    #unset GITHUB_TOKEN

####################################################################################################################################################################################
## Trivy
####################################################################################################################################################################################
trivy-config:
    echo "Running Trivy IaC and Configuration security checker..."
    trivy config .

trivy-fs:
    echo "Running Trivy FileSystem security checker..."
    trivy fs .

trivy-image:
    echo "Running Trivy image security checker..."
    trivy image ghcr.io/zmynx/aws-lambda-calculator

trivy-repository:
    echo "Running Trivy repository security checker..."
    trivy repository .

trivy-sbon:
    echo "Running Trivy sbom security checker..."
    trivy sbom .
