"""
Winston-equivalent logger configuration for the Flask application.

This module provides a centralized logging instance configured for both
console and file output with environment-aware formatting. Replaces the
Winston logger from the Node.js implementation.

Features:
- Console output with colored formatting (development)
- File output with JSON-like structured formatting (production)
- Environment-aware log level configuration
- HTTP request logging support

Example:
    >>> from utils.logger import logger
    >>> logger.info('Server started', extra={'port': 3000})
    >>> logger.error('Connection failed', extra={'error': 'timeout'})
"""

import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

try:
    import colorlog
    HAS_COLORLOG = True
except ImportError:
    HAS_COLORLOG = False


class JsonFormatter(logging.Formatter):
    """
    Custom formatter that outputs log records in a JSON-like structured format.
    Used for file logging and production console output.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured string."""
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add extra fields if present
        if hasattr(record, 'extra_data'):
            log_data.update(record.extra_data)

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        # Format as key=value pairs for readability while being structured
        parts = [f'{k}={repr(v)}' for k, v in log_data.items()]
        return ' '.join(parts)


class ExtraAdapter(logging.LoggerAdapter):
    """
    Logger adapter that handles extra keyword arguments consistently.
    Allows passing extra data as kwargs that get merged into log records.
    """

    def process(self, msg, kwargs):
        """Process log message and kwargs."""
        # Extract extra dict if provided
        extra = kwargs.get('extra', {})
        if extra:
            kwargs['extra'] = {'extra_data': extra}
        return msg, kwargs


def get_log_level(level_name: str) -> int:
    """
    Convert log level name to logging module constant.

    Args:
        level_name: String name of log level

    Returns:
        Logging level constant
    """
    levels = {
        'critical': logging.CRITICAL,
        'error': logging.ERROR,
        'warning': logging.WARNING,
        'info': logging.INFO,
        'debug': logging.DEBUG,
    }
    return levels.get(level_name.lower(), logging.INFO)


def setup_logger(name: str = 'app', log_level: str = 'info',
                 is_development: bool = True) -> ExtraAdapter:
    """
    Set up and configure the application logger.

    Creates a logger with:
    - Console handler with colored output (development) or structured output (production)
    - File handler with rotating log files
    - Appropriate log level based on environment

    Args:
        name: Logger name
        log_level: Log level string (debug, info, warning, error, critical)
        is_development: Whether running in development mode

    Returns:
        Configured logger adapter instance
    """
    # Create base logger
    base_logger = logging.getLogger(name)
    base_logger.setLevel(get_log_level(log_level))

    # Clear any existing handlers
    base_logger.handlers.clear()

    # Prevent propagation to root logger
    base_logger.propagate = False

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(get_log_level(log_level))

    if is_development and HAS_COLORLOG:
        # Use colored output in development
        color_formatter = colorlog.ColoredFormatter(
            '%(log_color)s%(asctime)s [%(levelname)s]%(reset)s %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            log_colors={
                'DEBUG': 'cyan',
                'INFO': 'green',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            }
        )
        console_handler.setFormatter(color_formatter)
    else:
        # Use structured output in production or if colorlog not available
        if is_development:
            formatter = logging.Formatter(
                '%(asctime)s [%(levelname)s] %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        else:
            formatter = JsonFormatter()
        console_handler.setFormatter(formatter)

    base_logger.addHandler(console_handler)

    # Create file handler with rotation
    # Create logs directory if it doesn't exist
    logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
    os.makedirs(logs_dir, exist_ok=True)

    # Combined log file (all levels)
    combined_log_path = os.path.join(logs_dir, 'combined.log')
    file_handler = RotatingFileHandler(
        combined_log_path,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(JsonFormatter())
    base_logger.addHandler(file_handler)

    # Error log file (errors only)
    error_log_path = os.path.join(logs_dir, 'error.log')
    error_handler = RotatingFileHandler(
        error_log_path,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(JsonFormatter())
    base_logger.addHandler(error_handler)

    # Wrap in adapter for extra kwargs support
    return ExtraAdapter(base_logger, {})


def get_logger(name: str = 'app') -> ExtraAdapter:
    """
    Get or create a logger with the specified name.

    This function allows creating named loggers for different modules
    while maintaining consistent configuration.

    Args:
        name: Logger name

    Returns:
        Configured logger adapter instance
    """
    # Import config here to avoid circular imports
    try:
        from src.config import config
        return setup_logger(name, config.log_level, config.is_development)
    except ImportError:
        # Fallback if config not available
        return setup_logger(name, 'info', True)


# Create default application logger
# Import config with try/except to handle import before config is ready
try:
    from src.config import config
    logger = setup_logger('app', config.log_level, config.is_development)
except ImportError:
    # Fallback logger if config not yet available
    logger = setup_logger('app', 'info', True)


__all__ = ['logger', 'get_logger', 'setup_logger']
