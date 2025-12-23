"""
Routes package initialization and aggregation.

This module serves as the central routing hub for the Flask application,
registering all route blueprints to their respective paths. Equivalent to
the Node.js Express.js routes/index.js module.

Route Structure:
    - GET /           → Returns "Hello, World!" (text/plain)
    - GET /health     → Health check with status, uptime, memory metrics
    - POST /echo      → Echoes the request body back to the client
    - GET /info       → Returns server metadata

Example:
    >>> from flask import Flask
    >>> from routes import register_routes
    >>> app = Flask(__name__)
    >>> register_routes(app)
"""

from flask import Blueprint, Response

# Create main blueprint for root routes
main_bp = Blueprint('main', __name__)


@main_bp.route('/', methods=['GET'])
def root():
    """
    GET / - Root endpoint handler.

    Returns the classic "Hello, World!" message with text/plain content type.
    This endpoint preserves the exact response format from the original server.js
    implementation to maintain backward compatibility.

    Returns:
        Response: Plain text "Hello, World!\n" with HTTP 200
    """
    return Response(
        'Hello, World!\n',
        status=200,
        mimetype='text/plain'
    )


def register_routes(app):
    """
    Register all route blueprints with the Flask application.

    This function aggregates all route modules and registers them
    with the appropriate URL prefixes.

    Args:
        app: Flask application instance
    """
    # Import blueprints from route modules
    from .health import health_bp
    from .api import api_bp

    # Register main blueprint at root
    app.register_blueprint(main_bp)

    # Register health blueprint at /health
    app.register_blueprint(health_bp, url_prefix='/health')

    # Register API blueprint at root (per original spec, /echo and /info are at root)
    app.register_blueprint(api_bp)


__all__ = ['register_routes', 'main_bp']
