import logging
from logging.handlers import RotatingFileHandler
from colorama import Fore, Style, init

# Initialize colorama
init(autoreset=True)

APP_NAME = "aws_lambda_calculator"

# Define log colors
LOG_COLORS = {
    "DEBUG": Fore.CYAN,
    "INFO": Fore.GREEN,
    "WARNING": Fore.YELLOW,
    "ERROR": Fore.RED,
    "CRITICAL": Fore.MAGENTA + Style.BRIGHT,
}


class ColoredFormatter(logging.Formatter):
    def format(self, record):
        log_color = LOG_COLORS.get(record.levelname.strip(), Fore.WHITE)
        # Align log level with padding
        record.levelname = f"{log_color}{record.levelname.ljust(8)}{Style.RESET_ALL}"
        return super().format(record)


# Create a logger
logger = logging.getLogger(APP_NAME)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see all levels

# Define format
formatter = ColoredFormatter(
    "%(asctime)s %(name)s %(levelname)s [%(filename)s:%(lineno)d] - %(message)s"
)

# Console Handler with colors
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

# File Handler (no colors, but with aligned levels)
file_handler = RotatingFileHandler(
    f"{APP_NAME}.log", maxBytes=5 * 1024 * 1024, backupCount=3
)
file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s %(name)s %(levelname)-8s [%(filename)s:%(lineno)d] - %(message)s"
    )
)

# Add handlers
logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Expose the logger for imports
__all__ = ["logger"]
