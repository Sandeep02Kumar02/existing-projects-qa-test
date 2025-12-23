"""
Centralized Flask error handling middleware module.

This module implements error handlers for Flask providing structured JSON error
responses with environment-aware stack trace handling (hidden in production,
shown in development).

Equivalent to Node.js Express.js middleware/errorHandler.js module.

Features:
    - Structured JSON error responses with consistent format
    - Environment-aware error detail (full details in development, sanitized in production)
    - Stack trace inclusion controlled by environment
    - Comprehensive error logging

Example:
    >>> from middleware.error_handler import register_error_handlers
    >>> app = Flask(__name__)
    >>> register_error_handlers(app)
"""

import traceback
from flask import jsonify, request
from werkzeug.exceptions import HTTPException


# Generic error message for production
GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.'


def is_client_error(status_code: int) -> bool:
    """
    Determine if an error is a client error (4xx).

    Args:
        status_code: HTTP status code

    Returns:
        True if status code is in 4xx range
    """
    return 400 <= status_code < 500


def get_error_name(status_code: int, error: Exception = None) -> str:
    """
    Get appropriate error name/type for the response.

    Args:
        status_code: HTTP status code
        error: The exception object

    Returns:
        Error name string
    """
    # Map common status codes to error names
    status_code_names = {
        400: 'BadRequestError',
        401: 'UnauthorizedError',
        403: 'ForbiddenError',
        404: 'NotFoundError',
        405: 'MethodNotAllowedError',
        409: 'ConflictError',
        422: 'UnprocessableEntityError',
        429: 'TooManyRequestsError',
        500: 'InternalServerError',
        502: 'BadGatewayError',
        503: 'ServiceUnavailableError',
        504: 'GatewayTimeoutError',
    }

    # Use error class name if available
    if error and hasattr(error, '__class__'):
        error_name = error.__class__.__name__
        if error_name != 'Exception' and error_name != 'HTTPException':
            return error_name

    return status_code_names.get(status_code, 'InternalServerError')


def sanitize_error_message(error: Exception, status_code: int, is_development: bool) -> str:
    """
    Sanitize error message based on environment and error type.

    In production, only client error messages (4xx) are exposed.
    Server errors (5xx) always show a generic message in production.

    Args:
        error: The exception object
        status_code: HTTP status code
        is_development: Whether running in development mode

    Returns:
        Sanitized error message safe for client response
    """
    # In development, always show the actual error message
    if is_development:
        return str(error) or GENERIC_ERROR_MESSAGE

    # In production, only show client error messages (4xx)
    if is_client_error(status_code) and str(error):
        return str(error)

    # For server errors in production, return generic message
    return GENERIC_ERROR_MESSAGE


def register_error_handlers(app):
    """
    Register error handlers with the Flask application.

    Sets up handlers for:
    - 404 Not Found errors
    - 405 Method Not Allowed errors
    - 500 Internal Server errors
    - Generic HTTP exceptions
    - Unhandled exceptions

    Args:
        app: Flask application instance
    """
    # Import logger here to avoid circular imports
    try:
        from src.utils.logger import logger
    except ImportError:
        import logging
        logger = logging.getLogger('app')

    # Import config here to avoid circular imports
    try:
        from src.config import config
        is_development = config.is_development
    except ImportError:
        import os
        is_development = os.getenv('FLASK_ENV', 'development') != 'production'

    @app.errorhandler(404)
    def not_found_error(error):
        """
        Handle 404 Not Found errors.

        Returns structured JSON error response for requests to undefined endpoints.
        """
        path = request.path
        method = request.method

        logger.warning(f'404 Not Found: {method} {path}')

        error_response = {
            'status': 'fail',
            'error': 'NotFoundError',
            'message': f'Cannot {method} {path}',
            'path': path
        }

        return jsonify(error_response), 404

    @app.errorhandler(405)
    def method_not_allowed_error(error):
        """
        Handle 405 Method Not Allowed errors.

        Returns structured JSON error response for requests with invalid HTTP methods.
        """
        path = request.path
        method = request.method

        logger.warning(f'405 Method Not Allowed: {method} {path}')

        error_response = {
            'status': 'fail',
            'error': 'MethodNotAllowedError',
            'message': f'Method {method} not allowed for {path}',
            'path': path
        }

        return jsonify(error_response), 405

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        """
        Handle all HTTP exceptions.

        Returns structured JSON error response for all HTTP errors.
        """
        status_code = error.code
        path = request.path
        method = request.method

        logger.error(f'HTTP Exception: {status_code} {method} {path}', extra={
            'error': get_error_name(status_code, error),
            'message': str(error),
            'status_code': status_code,
            'path': path,
            'method': method
        })

        message = sanitize_error_message(error, status_code, is_development)

        error_response = {
            'status': 'error' if status_code >= 500 else 'fail',
            'error': get_error_name(status_code, error),
            'message': message,
            'path': path
        }

        # Include stack trace in development
        if is_development:
            error_response['stack'] = traceback.format_exc()

        return jsonify(error_response), status_code

    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        """
        Handle all unhandled exceptions.

        Catches any exceptions that aren't HTTP exceptions and returns
        a structured 500 Internal Server Error response.
        """
        path = request.path
        method = request.method
        status_code = 500

        logger.error('Unhandled Exception', extra={
            'error': get_error_name(status_code, error),
            'message': str(error),
            'status_code': status_code,
            'path': path,
            'method': method,
            'stack': traceback.format_exc()
        })

        message = sanitize_error_message(error, status_code, is_development)

        error_response = {
            'status': 'error',
            'error': get_error_name(status_code, error),
            'message': message,
            'path': path
        }

        # Include stack trace in development
        if is_development:
            error_response['stack'] = traceback.format_exc()

        return jsonify(error_response), status_code


__all__ = ['register_error_handlers']
