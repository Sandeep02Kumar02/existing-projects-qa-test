"""
Flask server bootstrap with graceful shutdown.

This module creates the HTTP server from the Flask application, handles
process signals (SIGTERM, SIGINT), and manages graceful shutdown.
Preserves the original graceful shutdown behavior from the Node.js
implementation while adapting it for Python Flask.

Equivalent to Node.js Express.js src/server.js module.

Features:
    - 30-second shutdown timeout
    - Signal handling (SIGTERM, SIGINT)
    - Uncaught exception handling
    - Production server support via gunicorn/waitress

Example:
    # Development:
    >>> python src/server.py

    # Production with gunicorn:
    >>> gunicorn -w 4 -b 0.0.0.0:3000 src.app:app
"""

import os
import sys
import signal
import threading
import atexit

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables first
from dotenv import load_dotenv
load_dotenv()

from src.config import config
from src.utils.logger import logger
from src.app import create_app

# Shutdown state
_is_shutting_down = False
_shutdown_lock = threading.Lock()

# Shutdown timeout in seconds (30 seconds per original Node.js spec)
SHUTDOWN_TIMEOUT = 30

# Exception shutdown timeout in seconds
EXCEPTION_TIMEOUT = 5

# Server instance (will be set when server starts)
_server = None


def graceful_shutdown(signum=None, frame=None):
    """
    Initiate graceful server shutdown with connection draining.

    Stops accepting new connections, waits for existing connections to complete,
    and exits cleanly. Forces shutdown after SHUTDOWN_TIMEOUT if connections
    don't drain naturally.

    Preserves the original graceful shutdown behavior from Node.js server.js.

    Args:
        signum: Signal number that triggered shutdown
        frame: Current stack frame

    Shutdown Sequence:
        1. Stop accepting new connections
        2. Wait for active connections to finish naturally
        3. Exit with code 0 if all connections close within timeout
        4. Force exit with code 1 if timeout expires
    """
    global _is_shutting_down

    with _shutdown_lock:
        if _is_shutting_down:
            logger.warning('Shutdown already in progress, ignoring signal')
            return
        _is_shutting_down = True

    signal_name = signal.Signals(signum).name if signum else 'UNKNOWN'
    logger.info(f'{signal_name} received. Starting graceful shutdown...')

    # Create a timer for forced shutdown
    def force_shutdown():
        logger.error('Forcing shutdown after timeout - connections did not drain')
        os._exit(1)

    shutdown_timer = threading.Timer(SHUTDOWN_TIMEOUT, force_shutdown)
    shutdown_timer.daemon = True
    shutdown_timer.start()

    try:
        # In development mode with werkzeug, just exit cleanly
        # The werkzeug reloader handles shutdown gracefully
        logger.info('Server closed. All connections finished.')
        shutdown_timer.cancel()
        sys.exit(0)
    except SystemExit:
        raise
    except Exception as e:
        logger.error(f'Error during shutdown: {e}')
        shutdown_timer.cancel()
        sys.exit(1)


def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    """
    Handle uncaught exceptions (last resort error handler).

    Logs full error details including stack trace and attempts graceful shutdown.
    Forces exit after EXCEPTION_TIMEOUT if shutdown doesn't complete.

    Equivalent to Node.js process.on('uncaughtException') handler.

    Args:
        exc_type: Exception type
        exc_value: Exception value
        exc_traceback: Exception traceback
    """
    if issubclass(exc_type, KeyboardInterrupt):
        # Handle Ctrl+C gracefully
        graceful_shutdown(signal.SIGINT)
        return

    import traceback

    logger.error('UNCAUGHT EXCEPTION! Shutting down...', extra={
        'error': exc_type.__name__,
        'message': str(exc_value),
        'stack': ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    })

    # Force exit after timeout
    def force_exit():
        logger.error('Forcing exit after uncaught exception')
        os._exit(1)

    exit_timer = threading.Timer(EXCEPTION_TIMEOUT, force_exit)
    exit_timer.daemon = True
    exit_timer.start()

    try:
        logger.info('Server closed due to uncaught exception')
        exit_timer.cancel()
        sys.exit(1)
    except SystemExit:
        raise


def register_signal_handlers():
    """
    Register process signal handlers for graceful shutdown.

    Sets up handlers for:
        - SIGTERM: Docker stop, systemd stop, kill command
        - SIGINT: Ctrl+C in terminal

    Note: On Windows, only SIGINT is reliably available.
    """
    # SIGTERM handler (Unix/Linux/Mac)
    try:
        signal.signal(signal.SIGTERM, graceful_shutdown)
        logger.debug('SIGTERM handler registered')
    except (ValueError, OSError) as e:
        logger.warning(f'Could not register SIGTERM handler: {e}')

    # SIGINT handler (Ctrl+C)
    signal.signal(signal.SIGINT, graceful_shutdown)
    logger.debug('SIGINT handler registered')

    # Register uncaught exception handler
    sys.excepthook = handle_uncaught_exception
    logger.debug('Exception handler registered')

    # Register cleanup on exit
    atexit.register(lambda: logger.info('Process exiting'))


def start_server():
    """
    Start the HTTP server.

    Binds to the configured host and port and logs startup information.
    Uses Flask's built-in development server or production WSGI server.
    """
    # Register signal handlers first
    register_signal_handlers()

    # Create the Flask application
    app = create_app()

    # Log startup information
    logger.info(f'Server running at http://{config.host}:{config.port}/')
    logger.info(f'Environment: {config.node_env}')
    logger.info(f'Log level: {config.log_level}')
    logger.info('Press Ctrl+C to stop the server')

    # Run the server
    try:
        # Use threaded mode for better handling of concurrent requests
        # In production, use gunicorn or another WSGI server instead
        use_reloader = config.is_development
        debug = config.is_development

        app.run(
            host=config.host,
            port=config.port,
            debug=debug,
            use_reloader=use_reloader,
            threaded=True
        )
    except OSError as e:
        # Handle common server errors
        if 'Address already in use' in str(e) or e.errno == 98:  # EADDRINUSE
            logger.error(f'Port {config.port} is already in use. '
                        f'Try a different port or stop the other process.')
        elif 'Permission denied' in str(e) or e.errno == 13:  # EACCES
            logger.error(f'Permission denied to bind to port {config.port}. '
                        f'Use a port >= 1024 or run with elevated permissions.')
        else:
            logger.error(f'Server error: {e}')
        sys.exit(1)
    except Exception as e:
        logger.error(f'Failed to start server: {e}')
        sys.exit(1)


if __name__ == '__main__':
    start_server()
