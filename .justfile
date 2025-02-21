#!/usr/bin/env just --justfile

# Set shell for non-Windows OSs:
#set shell := ["/bin/bash", "-c"]
set shell := ["powershell.exe", "-c"]

# set defaults
bin := "main.py"
req_file := "requirements.txt"

# Default recipe to display help information
default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose

# Run-all
all: env && clean install check run

# Set env
env:
    echo "Setting up the environment..."
    pyenv local 3.13
    python --version

# Run the Python script
run:
    echo "Running the Python script..."
    python -m poetry run python {{bin}}

lint:
    echo "Running lint checks with Ruff..."
    python -m poetry run ruff format

# Type check with mypy
type-check:
    echo "Running type checks with mypy..."
    python -m poetry run mypy {{bin}}

# Format code with black
format:
    echo "Formatting code with black..."
    python -m poetry run black {{bin}}

# Install dependencies with Poetry
install:
    echo "Installing dependencies with Poetry..."
    python -m pip install --upgrade pip
    python -m pip install poetry
    python -m poetry install

# Generate a requirements.txt file
export:
    echo "Generating requirements.txt file.."
    python -m poetry export --format {{req_file}} --without-hashes --output {{req_file}}

# Full check: lint, type-check, and format
check:
    just lint
    just type-check
    just format

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

