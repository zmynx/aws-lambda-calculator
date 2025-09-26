# Run-all
[no-cd]
poetry-all: poetry-env && poetry-clean poetry-install poetry-lint poetry-checks poetry-run

# Set env
[no-cd]
poetry-env:
    echo "Setting up the environment..."
    pyenv local 3.13.0
    python --version

# Run the Python script
[no-cd]
poetry-run:
    echo "Running the Python script..."
    python -m poetry run python {{bin}}

# Lint the code
[no-cd]
poetry-lint:
    echo "Running lint checks with Ruff..."
    python -m poetry run ruff format
    python -m poetry run ruff check --fix

# Type check with mypy
[no-cd]
poetry-type-check:
    echo "Running type checks with mypy..."
# echo {{dir}}
# python -m poetry run mypy {{dir}} --show-error-codes --ignore-missing-imports

# Install dependencies with Poetry
[no-cd]
poetry-install:
    echo "Installing dependencies with Poetry..."
    python -m pip install --upgrade pip
    python -m pip install poetry
    python -m poetry install

# Full check: lint, type-check, and format
[no-cd]
poetry-checks: poetry-lint

# Create a tarball, wheel, dist from this package
[no-cd]
poetry-build:
    echo "Building the package..."
    python -m poetry build

# Ugrade the project package version
# ARG can be one of the following patch, minor, major, prepatch, preminor, premajor, prerelease.
[no-cd]
poetry-version ARG:
    echo "Updating the project package version..."
    python -m poetry version {{ARG}}

# Generate a requirements.txt file
[no-cd]
poetry-export:
    echo "Generating requirements.txt file..."
    python -m poetry export --format {{req_file}} --all-groups --without-hashes --output {{req_file}}

# Clean cache (optional)
[no-cd]
poetry-clean:
    echo "Cleaning .pyc files and cache..."
    find . -name "*.pyc" -delete
    find . -name "__pycache__" -delete
