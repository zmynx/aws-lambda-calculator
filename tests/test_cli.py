import pytest
import subprocess


def run_cli(*args):
    """Helper function to run cli.py and return output."""
    result = subprocess.run(
        ["python", "src/cli.py", *args], capture_output=True, text=True
    )
    return result.stdout, result.stderr, result.returncode


def test_cli_success():
    """Test CLI with valid input."""
    stdout, stderr, exit_code = run_cli(
        "--name", "Alice", "--age", "30", "--country", "Canada"
    )

    assert exit_code == 0
    assert "Executing my_function with name=Alice, age=30, country=Canada" in stdout


def test_cli_missing_argument():
    """Test CLI when required arguments are missing."""
    stdout, stderr, exit_code = run_cli("--name", "Bob", "--age", "30")  # No country

    assert exit_code != 0  # Should fail
    assert "error: the following arguments are required: --country" in stderr


def test_cli_verbose_mode():
    """Test CLI verbose mode."""
    stdout, stderr, exit_code = run_cli(
        "--name", "Charlie", "--age", "25", "--country", "UK", "--verbose"
    )

    assert exit_code == 0
    assert "DEBUG" in stdout  # Debug logs should appear
