# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is an AWS Lambda cost calculator with two main components:
- **Core library** (`aws-lambda-calculator/`): The main calculation engine implemented in Python
- **Wrapper application** (root level): CLI and Lambda handler wrappers around the core library

### Key Architecture Components

1. **Core Calculator** (`aws-lambda-calculator/src/aws_lambda_calculator/calculator.py`):
   - Main `calculate()` function that handles AWS Lambda cost calculations
   - Supports tiered pricing, different regions, architectures (x86/arm64)
   - Uses JSON pricing data files for each AWS region (`jsons/` directory)

2. **CLI Interface** (`src/cli.py`):
   - Command-line tool with comprehensive argument parsing
   - Supports all AWS regions and both x86/arm64 architectures
   - Verbose logging option available

3. **Lambda Handler** (`src/aws_lambda.py`):
   - AWS Lambda function handler for serverless deployment
   - Processes JSON events and returns cost calculations

4. **Pricing Data** (`aws-lambda-calculator/src/aws_lambda_calculator/jsons/`):
   - Region-specific JSON files containing AWS pricing information
   - Separate pricing for x86 and arm64 architectures
   - Includes tiered pricing structures

## Development Commands

### Poetry-based Development
The project uses Poetry for dependency management. Use these commands via the justfile system:

```bash
# Setup environment (requires Python 3.13)
just poetry-env

# Install dependencies
just poetry-install

# Run linting and formatting
just poetry-lint

# Type checking (mypy configuration available but commands commented out)
just poetry-type-check

# Run full check pipeline
just poetry-checks

# Clean cache and build artifacts
just poetry-clean

# Build package
just poetry-build
```

### Testing
```bash
# Run tests with coverage
python -m poetry run pytest

# The project is configured to generate coverage.xml reports
# Test paths: tests/ (root level) and aws-lambda-calculator/tests/
```

### Running the Application
```bash
# CLI usage example
python -m poetry run python src/cli.py -r us-east-1 -a x86 -n 1000000 -nu "per month" -d 1500 -m 128 -mu MB -es 512 -esu MB

# Direct library usage
python -c "from aws_lambda_calculator import calculate; print(calculate())"
```

## Nix Development Environment

The project includes a Nix flake (`flake.nix`) that provides:
- Python 3.13 with pyenv
- Docker and AWS CLI tools
- CDK and cloud development tools
- Just command runner

Enter the development shell with: `nix develop`

## Code Organization

- **Main calculation logic**: `aws-lambda-calculator/src/aws_lambda_calculator/calculator.py`
- **Pricing data scraper**: `aws-lambda-calculator/src/aws_lambda_calculator/pricing_scraper.py`
- **Utility logger**: `src/utils/logger.py`
- **Tests**: Split between root `tests/` and `aws-lambda-calculator/tests/`
- **Serverless deployment**: `serverless/cdk-app/` (CDK TypeScript app)

## Important Implementation Details

1. **Dual pyproject.toml**: Root level manages wrappers, nested directory manages core library
2. **Regional pricing**: Each AWS region has its own JSON pricing file
3. **Tiered pricing calculation**: Complex tiered billing logic in `calculate_tiered_cost()`
4. **Unit conversions**: Handles various time units (per second/minute/hour/day/month) and memory units (MB/GB)
5. **Architecture support**: Different pricing for x86 vs arm64 Lambda functions

## Dependencies

Main dependencies include:
- `colorama` for CLI coloring
- `python-dotenv` for environment variable loading
- `requests` for HTTP operations (pricing scraper)
- `boto3` for AWS integration
- Development tools: `ruff`, `pytest`, `mypy`, `pytest-cov`