"""
Middleware package initialization.

This package contains Flask middleware and error handling modules.
Equivalent to Node.js Express.js middleware directory.
"""

from .error_handler import register_error_handlers

__all__ = ['register_error_handlers']
