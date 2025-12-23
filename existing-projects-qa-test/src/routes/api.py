"""
Flask blueprint for API endpoints.

This module implements API routes for the Flask application including:
- POST /echo: Request body reflection endpoint
- GET /info: Server metadata endpoint

Equivalent to Node.js Express.js routes/api.js module.

Example:
    Echo endpoint:
    >>> curl -X POST http://localhost:3000/echo -H "Content-Type: application/json" -d '{"message": "Hello"}'
    {"echo": {"message": "Hello"}}

    Info endpoint:
    >>> curl http://localhost:3000/info
    {"name": "hello_world", "version": "1.0.0", ...}
"""

import sys
import platform
from flask import Blueprint, jsonify, request

from .health import get_uptime

# Create API blueprint
api_bp = Blueprint('api', __name__)


@api_bp.route('/echo', methods=['POST'])
def echo():
    """
    POST /echo - Request body reflection endpoint.

    Reflects the incoming request body back to the client. This endpoint is
    useful for testing request/response cycles, debugging API integrations,
    and verifying that request body parsing is functioning correctly.

    The endpoint expects a JSON body and returns it wrapped in an "echo" property.

    Returns:
        Response: JSON response with echoed body (HTTP 200)

    Example Request:
        curl -X POST http://localhost:3000/echo \\
            -H "Content-Type: application/json" \\
            -d '{"message": "Hello", "count": 42}'

    Example Response:
        {
            "echo": {
                "message": "Hello",
                "count": 42
            }
        }
    """
    # Get JSON body, default to empty dict if not provided or invalid
    body = request.get_json(force=True, silent=True) or {}

    echo_response = {
        'echo': body
    }

    return jsonify(echo_response), 200


@api_bp.route('/info', methods=['GET'])
def info():
    """
    GET /info - Server metadata endpoint.

    Returns metadata about the running server including application name,
    version, description, Python runtime version, current environment mode,
    and server uptime in seconds.

    This endpoint is useful for monitoring, debugging, and health verification
    of deployed instances.

    Returns:
        Response: JSON response with server metadata (HTTP 200)

    Example Response:
        {
            "name": "hello_world",
            "version": "1.0.0",
            "description": "Flask HTTP Server",
            "pythonVersion": "3.11.0",
            "environment": "development",
            "uptime": 12345.678
        }
    """
    # Import config here to avoid circular imports
    try:
        from src.config import config
        environment = config.node_env
    except ImportError:
        import os
        environment = os.getenv('FLASK_ENV', os.getenv('NODE_ENV', 'development'))

    info_response = {
        'name': 'hello_world',
        'version': '1.0.0',
        'description': 'Flask HTTP Server',
        'pythonVersion': platform.python_version(),
        'environment': environment,
        'uptime': get_uptime()
    }

    return jsonify(info_response), 200


__all__ = ['api_bp']
