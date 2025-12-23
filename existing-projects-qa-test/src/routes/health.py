"""
Flask blueprint for health check endpoint.

This module provides a health check endpoint for monitoring application health status
with comprehensive metrics including status indicator, timestamp, uptime duration,
and memory usage statistics. Designed for use by monitoring systems, load balancers,
and orchestration platforms for health probes.

Equivalent to Node.js Express.js routes/health.js module.

Example:
    Health check request:
    >>> curl http://localhost:3000/health
    {
        "status": "ok",
        "timestamp": "2024-12-22T14:30:00.000Z",
        "uptime": 12345.67,
        "memory": {
            "rss": 34567890,
            "heapTotal": 23456789,
            "heapUsed": 12345678
        }
    }
"""

import time
from datetime import datetime, timezone
from flask import Blueprint, jsonify

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Create health blueprint
health_bp = Blueprint('health', __name__)

# Store server start time for uptime calculation
_start_time = time.time()


def get_memory_usage() -> dict:
    """
    Get current memory usage statistics.

    Returns memory metrics similar to Node.js process.memoryUsage():
    - rss: Resident Set Size - total memory allocated
    - heapTotal: Approximation of total heap (Python doesn't have exact equivalent)
    - heapUsed: Approximation of used heap

    Returns:
        dict: Memory usage statistics in bytes
    """
    if HAS_PSUTIL:
        process = psutil.Process()
        mem_info = process.memory_info()
        return {
            'rss': mem_info.rss,
            'heapTotal': mem_info.vms,  # Virtual memory size as approximation
            'heapUsed': mem_info.rss,   # RSS as used memory approximation
            'external': 0,              # Python doesn't track this separately
            'arrayBuffers': 0           # Python doesn't have ArrayBuffers
        }
    else:
        # Fallback if psutil not available
        import resource
        try:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            # Convert from KB to bytes (on most systems)
            rss = usage.ru_maxrss * 1024
            return {
                'rss': rss,
                'heapTotal': rss,
                'heapUsed': rss,
                'external': 0,
                'arrayBuffers': 0
            }
        except (ImportError, AttributeError):
            # Final fallback - return zeros
            return {
                'rss': 0,
                'heapTotal': 0,
                'heapUsed': 0,
                'external': 0,
                'arrayBuffers': 0
            }


def get_uptime() -> float:
    """
    Get server uptime in seconds.

    Returns:
        float: Number of seconds since server start
    """
    return time.time() - _start_time


@health_bp.route('/', methods=['GET'], strict_slashes=False)
def health_check():
    """
    GET /health - Health check endpoint.

    Returns comprehensive application health status including runtime metrics
    for monitoring and load balancer health probes. The response provides
    real-time information about the application's operational state.

    Response Structure:
        - status: Health status indicator ("ok" indicates healthy)
        - timestamp: Current server time in ISO 8601 format
        - uptime: Process uptime in seconds since server start
        - memory: Memory usage statistics

    Returns:
        Response: JSON response with health status (HTTP 200)

    Use Cases:
        - Load balancer health checks to verify server availability
        - Kubernetes liveness/readiness probes
        - Monitoring systems to collect server metrics
        - Application dashboards for real-time status display
    """
    health_response = {
        'status': 'ok',
        'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'uptime': get_uptime(),
        'memory': get_memory_usage()
    }

    return jsonify(health_response), 200


__all__ = ['health_bp', 'get_uptime', 'get_memory_usage']
