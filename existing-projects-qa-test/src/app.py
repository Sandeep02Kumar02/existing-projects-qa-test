"""
Flask application factory module.

This module creates and configures the Flask application instance with
the complete middleware stack (CORS, compression, security headers)
and mounts all route blueprints. Implements the factory pattern for
testability and separation of concerns.

Equivalent to Node.js Express.js src/app.js module.

Middleware Order:
    1. Security headers (via response hooks)
    2. CORS
    3. Compression
    4. Request logging (via before_request hook)
    5. Routes
    6. Error handlers

Example:
    >>> from app import create_app
    >>> app = create_app()
    >>> app.run(host='0.0.0.0', port=3000)
"""

import time
from flask import Flask, request, g
from flask_cors import CORS
from flask_compress import Compress

from src.config import config
from src.routes import register_routes
from src.middleware import register_error_handlers


def add_security_headers(response):
    """
    Add security headers to response.

    Equivalent to helmet middleware in Express.js.
    Sets various HTTP headers to protect against common web vulnerabilities.

    Args:
        response: Flask response object

    Returns:
        Response with security headers added
    """
    # X-Content-Type-Options: Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # X-Frame-Options: Prevent clickjacking
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'

    # X-XSS-Protection: Legacy XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'

    # Referrer-Policy: Control referrer information
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

    # Content-Security-Policy: Basic CSP
    response.headers['Content-Security-Policy'] = "default-src 'self'"

    # Strict-Transport-Security: Enforce HTTPS (only in production)
    if config.is_production:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # Remove X-Powered-By equivalent
    # Flask doesn't add this by default, but we ensure it's removed
    response.headers.pop('X-Powered-By', None)
    response.headers.pop('Server', None)

    return response


def create_app(test_config=None) -> Flask:
    """
    Create and configure the Flask application.

    This factory function creates a new Flask application instance,
    configures middleware, registers routes, and sets up error handlers.

    Args:
        test_config: Optional configuration dictionary for testing

    Returns:
        Configured Flask application instance

    Example:
        >>> app = create_app()
        >>> app.run(debug=True)

        # For testing:
        >>> app = create_app({'TESTING': True})
    """
    # Create Flask application
    app = Flask(__name__)

    # Configure application
    app.config['JSON_SORT_KEYS'] = False  # Preserve JSON key order

    # Apply test configuration if provided
    if test_config:
        app.config.update(test_config)

    # =========================================================================
    # MIDDLEWARE CONFIGURATION
    # =========================================================================

    # 1. Security Headers (via after_request hook)
    app.after_request(add_security_headers)

    # 2. CORS (Cross-Origin Resource Sharing)
    # Equivalent to cors() middleware in Express.js
    CORS(app, resources={
        r'/*': {
            'origins': '*',  # Allow all origins in development
            'methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            'allow_headers': ['Content-Type', 'Authorization']
        }
    })

    # 3. Compression
    # Equivalent to compression() middleware in Express.js
    Compress(app)

    # 4. Request Logging (via before_request hook)
    @app.before_request
    def log_request():
        """Log incoming request details."""
        g.request_start_time = time.time()

        # Import logger here to avoid circular imports at module level
        try:
            from src.utils.logger import logger
            logger.info(f'{request.method} {request.path}', extra={
                'method': request.method,
                'path': request.path,
                'ip': request.remote_addr,
                'user_agent': request.user_agent.string if request.user_agent else None
            })
        except ImportError:
            pass  # Logger not available

    @app.after_request
    def log_response(response):
        """Log response details including request duration."""
        # Calculate request duration
        duration = 0
        if hasattr(g, 'request_start_time'):
            duration = (time.time() - g.request_start_time) * 1000  # Convert to ms

        try:
            from src.utils.logger import logger
            logger.info(f'{request.method} {request.path} {response.status_code} {duration:.2f}ms', extra={
                'method': request.method,
                'path': request.path,
                'status_code': response.status_code,
                'duration_ms': duration,
                'content_length': response.content_length
            })
        except ImportError:
            pass  # Logger not available

        return response

    # =========================================================================
    # ROUTE REGISTRATION
    # =========================================================================

    # Register all application routes
    register_routes(app)

    # =========================================================================
    # ERROR HANDLER REGISTRATION
    # =========================================================================

    # Register error handlers (must be after routes)
    register_error_handlers(app)

    return app


# Create default application instance
app = create_app()


__all__ = ['create_app', 'app']
