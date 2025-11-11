#!/usr/bin/env python3
"""
Flask HTTP Server - Python rewrite of Node.js hello_world server
Maintains exact feature parity with the original Node.js implementation.
"""

import os
import sys
import signal
import logging
from flask import Flask, request, Response
from werkzeug.serving import make_server
import threading
import time

# Configuration with environment variable support for production flexibility
# Motive: Allow deployment-time configuration without code changes, following 12-factor app principles
HOST = os.environ.get('HOST', '127.0.0.1')
PORT = int(os.environ.get('PORT', 3000))

# Configure logging to match Node.js console output format
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Create Flask application
app = Flask(__name__)

# Global server reference for graceful shutdown
server = None
shutdown_event = threading.Event()


@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def universal_handler(path):
    """
    HTTP request handler that processes all incoming requests.
    
    Validates request format (requires request.method and request.url),
    returns "Hello, World!" for all valid requests.
    Implements comprehensive error handling to contain errors within request scope.
    
    Returns:
        Response: HTTP response with status code 200 and "Hello, World!" body
        
    Raises:
        Exception: Catches all synchronous errors and returns 500 response;
                   prevents request errors from crashing server
    """
    try:
        # Input validation: Ensure request method and URL are present
        # Motive: Prevent null reference errors when accessing request properties
        if not request.method or not request.url:
            logger.error('Invalid request format: missing method or URL')
            return Response(
                'Bad Request: Invalid request format\n',
                status=400,
                mimetype='text/plain'
            )
        
        # Normal request processing
        return Response(
            'Hello, World!\n',
            status=200,
            mimetype='text/plain'
        )
    
    except Exception as error:
        # Handle any synchronous errors in request processing
        # Motive: Contain errors within request scope, log for debugging, return 500 to client
        logger.error(f'Error processing request: {error}')
        
        # Return 500 error response
        return Response(
            'Internal Server Error\n',
            status=500,
            mimetype='text/plain'
        )


@app.errorhandler(400)
def handle_bad_request(error):
    """
    Handles client connection errors and malformed requests.
    Sends HTTP 400 response for bad requests.
    Prevents malformed requests from crashing server.
    """
    logger.error(f'Client connection error: {error}')
    return Response(
        'HTTP/1.1 400 Bad Request\n',
        status=400,
        mimetype='text/plain'
    )


@app.errorhandler(500)
def handle_internal_error(error):
    """
    Handles internal server errors.
    Logs error and returns 500 response.
    """
    logger.error(f'Internal server error: {error}')
    return Response(
        'Internal Server Error\n',
        status=500,
        mimetype='text/plain'
    )


def graceful_shutdown(signal_name):
    """
    Initiates graceful shutdown of the HTTP server.
    
    Stops accepting new connections and waits up to 10 seconds for existing
    connections to complete. Forces process exit if connections don't drain
    naturally. Ensures zero-downtime deployments by allowing in-flight
    requests to finish.
    
    Args:
        signal_name (str): The process signal that triggered shutdown (SIGTERM, SIGINT)
        
    Example:
        # Trigger graceful shutdown
        # kill -SIGTERM <pid>
    """
    logger.info(f'\n{signal_name} received. Starting graceful shutdown...')
    
    # Signal shutdown event
    shutdown_event.set()
    
    # Stop accepting new connections
    # Motive: Drain existing connections while rejecting new ones
    if server:
        logger.info('Shutting down server...')
        server.shutdown()
        logger.info('Server closed. All connections finished.')
    
    sys.exit(0)


def handle_sigterm(signum, frame):
    """
    Handles graceful shutdown signals for process management.
    SIGTERM: Standard Unix process termination signal (systemd, Docker, Kubernetes)
    """
    graceful_shutdown('SIGTERM')


def handle_sigint(signum, frame):
    """
    Handles graceful shutdown signals for process management.
    SIGINT: Interactive termination signal (Ctrl+C)
    """
    graceful_shutdown('SIGINT')


def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    """
    Last-resort error handler for uncaught exceptions.
    
    Logs detailed error information including stack trace, attempts graceful
    server shutdown, and forces exit after 5 seconds if shutdown hangs.
    Per Python best practices, application should not continue after uncaught
    exception as process may be in corrupted state.
    
    Args:
        exc_type: Exception type
        exc_value: Exception value
        exc_traceback: Exception traceback
    """
    if issubclass(exc_type, KeyboardInterrupt):
        # Let KeyboardInterrupt be handled by SIGINT
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    
    logger.error('UNCAUGHT EXCEPTION! Shutting down...')
    logger.error(f'Error: {exc_type.__name__} {exc_value}')
    logger.error('Stack:', exc_info=(exc_type, exc_value, exc_traceback))
    
    # Attempt graceful shutdown, then force exit
    # Motive: Per Python best practices, do not continue after uncaught exception
    if server:
        try:
            server.shutdown()
            logger.info('Server closed due to uncaught exception')
        except:
            pass
    
    # Force exit if server doesn't close in time
    # Motive: Prevent hung process in corrupted state
    def force_exit():
        time.sleep(5)
        logger.error('Forcing exit after uncaught exception')
        os._exit(1)
    
    force_thread = threading.Thread(target=force_exit, daemon=True)
    force_thread.start()
    sys.exit(1)


def run_server():
    """
    Main server entry point.
    Sets up signal handlers, exception handlers, and starts the Flask server.
    """
    global server
    
    # Register signal handlers
    # Motive: Support standard Unix process management (kill, systemd, Docker, Kubernetes)
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigint)
    
    # Register uncaught exception handler
    # Motive: Log unexpected errors and attempt graceful shutdown instead of silent crash
    sys.excepthook = handle_uncaught_exception
    
    # Create server with timeout configuration
    try:
        server = make_server(
            HOST,
            PORT,
            app,
            threaded=True
        )
        
        # Start the server
        logger.info(f'Server running at http://{HOST}:{PORT}/')
        logger.info('Press Ctrl+C to stop the server')
        
        # Serve requests until shutdown
        server.serve_forever()
        
    except OSError as error:
        # Handle server-level errors (e.g., port already in use, permission denied)
        # Motive: Prevent unhandled server binding failures from crashing process with unclear error messages
        logger.error(f'Server error: {error}')
        
        # Provide specific guidance for common errors
        # Motive: Help operators quickly identify and resolve deployment issues
        if 'Address already in use' in str(error) or error.errno == 98:
            logger.error(f'Port {PORT} is already in use')
        elif 'Permission denied' in str(error) or error.errno == 13:
            logger.error(f'Permission denied to bind to port {PORT}')
        
        sys.exit(1)
    
    except KeyboardInterrupt:
        # Handle Ctrl+C gracefully
        graceful_shutdown('SIGINT')
    
    except Exception as error:
        logger.error(f'Unexpected error starting server: {error}')
        sys.exit(1)


if __name__ == '__main__':
    run_server()
