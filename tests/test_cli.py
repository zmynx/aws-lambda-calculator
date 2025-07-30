import subprocess
import logging

logger = logging.getLogger(__name__)


def run_cli(*args):
    """Helper function to run cli.py and return output."""
    result = subprocess.run(
        ["python", "src/cli.py", *args], capture_output=True, text=True
    )
    return result.stdout, result.stderr, result.returncode


def test_cli_success():
    """Test CLI with valid input."""
    stdout, stderr, exit_code = run_cli(
        "--region",
        "us-east-1",
        "--architecture",
        "x86",
        "--number-of-requests",
        "1000000",  # 1 million requests
        "--request-unit",
        "per day",
        "--duration-of-each-request-in-ms",
        "100",  # 100 ms per request
        "--memory",
        "512",  # 512 MB
        "--memory-unit",
        "MB",
        "--ephemeral-storage",
        "10",  # 10 GB of ephemeral storage
        "--storage-unit",
        "GB",
    )

    logger.info(f"CLI output: {stdout}")
    logger.debug(f"exit code: {exit_code}, stdout: {stdout}")
    print(f"CLI output: {stdout}")
    print(f"exit code: {exit_code}, stderr: {stderr}")
    assert exit_code == 0
    assert "Total cost:" in stdout


def test_cli_invalid_region():
    """Test CLI with an invalid region."""
    stdout, stderr, exit_code = run_cli(
        "--region",
        "invalid-region",
        "--architecture",
        "x86",
        "--number-of-requests",
        "1000000",  # 1 million requests
        "--request-unit",
        "per day",
        "--duration-of-each-request-in-ms",
        "100",
        "--memory",
        "512",  # 512 MB
        "--memory-unit",
        "MB",
        "--ephemeral-storage",
        "10",  # 10 GB of ephemeral storage
        "--storage-unit",
        "GB",
    )

    logger.info(f"CLI output: {stdout}")
    logger.debug(f"exit code: {exit_code}, stdout: {stdout}")
    print(f"CLI output: {stdout}")
    print(f"exit code: {exit_code}, stderr: {stderr}")
    assert exit_code != 0
    assert "invalid choice:" in stderr


def test_cli_short_flags_success():
    """Test CLI with short flags."""
    stdout, stderr, exit_code = run_cli(
        "-r",
        "us-east-1",
        "-a",
        "x86",
        "-n",
        "1000000",  # 1 million requests
        "-nu",
        "per day",
        "-d",
        "100",  # 100 ms per request
        "-m",
        "512",  # 512 MB
        "-mu",
        "MB",
        "-es",
        "10",  # 10 GB of ephemeral storage
        "-esu",
        "GB",
        "-v",  # Enable verbose mode
    )

    logger.info(f"CLI output: {stdout}")
    logger.debug(f"exit code: {exit_code}, stdout: {stdout}")
    print(f"CLI output: {stdout}")
    print(f"exit code: {exit_code}, stderr: {stderr}")
    assert exit_code == 0
    assert "Total cost:" in stdout


def test_cli_missing_argument():
    """Test CLI when required arguments are missing."""
    stdout, stderr, exit_code = run_cli(
        "--region",
        "us-east-1",
        "--architecture",
        "x86",
        "--number-of-requests",
        "1000000",  # 1 million requests
        "--request-unit",
        "per day",
        "--duration-of-each-request-in-ms",
        "100",  # 100 ms per request
        "--memory",
        "512",  # 512 MB
        "--memory-unit",
        "MB",
        # Missing ephemeral storage and storage unit
    )

    logger.info(f"CLI output: {stdout}")
    logger.debug(f"exit code: {exit_code}, stdout: {stdout}")
    print(f"CLI output: {stdout}")
    print(f"exit code: {exit_code}, stderr: {stderr}")
    assert exit_code != 0  # Should fail
    assert (
        "the following arguments are required: -es/--ephemeral-storage, -esu/--storage-unit"
        in stderr
    )


def test_cli_verbose_mode():
    """Test CLI verbose mode."""
    stdout, stderr, exit_code = run_cli(
        "--region",
        "us-east-1",
        "--architecture",
        "x86",
        "--number-of-requests",
        "1000000",  # 1 million requests
        "--request-unit",
        "per day",
        "--duration-of-each-request-in-ms",
        "100",  # 100 ms per request
        "--memory",
        "512",  # 512 MB
        "--memory-unit",
        "MB",
        "--ephemeral-storage",
        "10",  # 10 GB of ephemeral storage
        "--storage-unit",
        "GB",
        "--verbose",  # Enable verbose mode
    )

    logger.info(f"CLI output: {stdout}")
    logger.debug(f"exit code: {exit_code}, stdout: {stdout}")
    print(f"CLI output: {stdout}")
    print(f"exit code: {exit_code}, stderr: {stderr}")
    assert exit_code == 0
    assert "DEBUG" in stdout or "DEBUG" in stderr  # Debug logs should appear
