"""
Centralized environment configuration module for the Flask application.

This module loads environment variables from .env files using python-dotenv and exports
a validated configuration object following 12-factor app principles. All environment
variable access is consolidated here to provide a single source of truth for
application configuration.

Migrated from Node.js Express.js implementation (src/config/index.js).

Example:
    >>> from config import config
    >>> print(config.port)
    3000
    >>> print(config.is_development)
    True
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file FIRST
# This ensures all modules have access to environment variables
load_dotenv()


def parse_port(port_value: str | None, default_port: int) -> int:
    """
    Parse and validate the PORT environment variable.

    Args:
        port_value: The raw PORT environment variable value
        default_port: The default port to use if parsing fails

    Returns:
        A valid port number

    Raises:
        ValueError: If the port number is outside the valid range (1-65535)
    """
    if port_value is None or port_value == '':
        return default_port

    try:
        parsed = int(port_value)
    except ValueError:
        print(f'Warning: Invalid PORT value "{port_value}", using default {default_port}',
              file=sys.stderr)
        return default_port

    # Validate port range (1-65535 for TCP/UDP ports)
    if parsed < 1 or parsed > 65535:
        raise ValueError(
            f'Invalid PORT value {parsed}. Port must be between 1 and 65535.'
        )

    # Warn about privileged ports that require elevated permissions
    if parsed < 1024:
        print(f'Warning: Port {parsed} is a privileged port and may require elevated permissions.',
              file=sys.stderr)

    return parsed


def parse_log_level(level_value: str | None, default_level: str) -> str:
    """
    Validate the LOG_LEVEL environment variable against allowed values.

    Args:
        level_value: The raw LOG_LEVEL environment variable value
        default_level: The default log level to use if invalid

    Returns:
        A valid log level string
    """
    # Python logging supported log levels
    valid_levels = ['critical', 'error', 'warning', 'info', 'debug']

    if level_value is None or level_value == '':
        return default_level

    normalized_level = level_value.lower().strip()

    # Map Node.js Winston levels to Python logging levels
    level_mapping = {
        'error': 'error',
        'warn': 'warning',
        'warning': 'warning',
        'info': 'info',
        'http': 'info',
        'verbose': 'debug',
        'debug': 'debug',
        'silly': 'debug',
    }

    if normalized_level in level_mapping:
        return level_mapping[normalized_level]

    if normalized_level not in valid_levels:
        print(f'Warning: Invalid LOG_LEVEL "{level_value}", using default "{default_level}". '
              f'Valid levels are: {", ".join(valid_levels)}',
              file=sys.stderr)
        return default_level

    return normalized_level


def parse_node_env(env_value: str | None, default_env: str) -> str:
    """
    Validate and normalize the environment mode variable.

    Args:
        env_value: The raw environment variable value
        default_env: The default environment to use

    Returns:
        A normalized environment string
    """
    if env_value is None or env_value == '':
        return default_env

    normalized_env = env_value.lower().strip()

    # Warn about non-standard environment names
    standard_envs = ['development', 'production', 'test', 'staging']
    if normalized_env not in standard_envs:
        print(f'Warning: Non-standard environment "{normalized_env}". '
              f'Standard values are: {", ".join(standard_envs)}',
              file=sys.stderr)

    return normalized_env


class Config:
    """
    Centralized application configuration class.

    This class consolidates all environment-based configuration settings,
    providing validated and typed access to server, environment, and logging
    configuration values.

    Attributes:
        port: Server port number (1-65535)
        host: Server bind address
        node_env: Current environment mode
        is_development: True if not in production mode
        is_production: True if in production mode
        log_level: Python logging level
    """

    def __init__(self):
        """Initialize configuration from environment variables."""
        # Server configuration
        self.port: int = parse_port(os.getenv('PORT'), 3000)
        self.host: str = os.getenv('HOST', '0.0.0.0')

        # Environment configuration
        # Support both FLASK_ENV and NODE_ENV for compatibility
        env_value = os.getenv('FLASK_ENV') or os.getenv('NODE_ENV')
        self.node_env: str = parse_node_env(env_value, 'development')
        self.is_development: bool = self.node_env != 'production'
        self.is_production: bool = self.node_env == 'production'

        # Logging configuration
        default_log_level = 'info' if self.is_production else 'debug'
        self.log_level: str = parse_log_level(os.getenv('LOG_LEVEL'), default_log_level)

    def __repr__(self) -> str:
        """Return string representation of configuration."""
        return (
            f'Config(port={self.port}, host="{self.host}", '
            f'node_env="{self.node_env}", log_level="{self.log_level}")'
        )


# Create singleton configuration instance
config = Config()


# Export for convenient access
__all__ = ['config', 'Config']
