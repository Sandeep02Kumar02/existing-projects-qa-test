#!/usr/bin/env python3
"""
Main entry point for the Flask application.

This script provides a convenient way to start the Flask server
from the project root directory.

Usage:
    python run.py
    
    # Or make it executable:
    chmod +x run.py
    ./run.py

For production deployment, use gunicorn:
    gunicorn -w 4 -b 0.0.0.0:3000 src.app:app
"""

import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.server import start_server

if __name__ == '__main__':
    start_server()
