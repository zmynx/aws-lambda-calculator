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
        "--duration-ms",
        "100",
        "--requests-millions",
        "2",
        "--concurrency",
        "5",
        "--ram-gb",
        "0.5",
    )

    assert exit_code == 0
    assert "Total cost:" in stdout


def test_cli_missing_argument():
    """Test CLI when required arguments are missing."""
    stdout, stderr, exit_code = run_cli(
        "--duration-ms",
        "100",
        "--requests-millions",
        "2",
        "--ram-gb",
        "0.5",  # Missing --concurrency
    )

    assert exit_code != 0  # Should fail
    assert "the following arguments are required" in stderr
    assert "--concurrency" in stderr or "-c/--concurrency" in stderr


def test_cli_verbose_mode():
    """Test CLI verbose mode."""
    stdout, stderr, exit_code = run_cli(
        "--duration-ms",
        "200",
        "--requests-millions",
        "1",
        "--concurrency",
        "3",
        "--ram-gb",
        "1.0",
        "--verbose",
    )

    assert exit_code == 0
    assert "DEBUG" in stdout or "DEBUG" in stderr  # Debug logs should appear
