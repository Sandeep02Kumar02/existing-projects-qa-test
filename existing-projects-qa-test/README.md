# Hello World Flask Server

A production-hardened Python Flask HTTP server with comprehensive error handling, graceful shutdown, and structured logging.

## Features

- **Zero-Dependency Core**: Pure Python implementation with minimal external dependencies
- **Production-Ready**: Graceful shutdown, structured logging, and comprehensive error handling
- **Environment-Based Configuration**: Flexible configuration via environment variables
- **Security Headers**: Helmet-equivalent security headers for protection against common web vulnerabilities
- **CORS Support**: Configurable Cross-Origin Resource Sharing
- **Response Compression**: Automatic gzip compression for improved performance
- **Request Logging**: Structured HTTP request logging with timing information

## Prerequisites

- **Python**: 3.8 or higher (3.11+ recommended)
- **pip**: Python package manager

## Project Structure

```
existing-projects-qa-test/
├── src/
│   ├── __init__.py
│   ├── app.py              # Flask application factory
│   ├── config.py           # Environment configuration
│   ├── server.py           # Server bootstrap with graceful shutdown
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── error_handler.py    # Error handling middleware
│   ├── routes/
│   │   ├── __init__.py         # Route registration
│   │   ├── api.py              # API routes (echo, info)
│   │   └── health.py           # Health check routes
│   └── utils/
│       ├── __init__.py
│       └── logger.py           # Logging configuration
├── logs/                   # Log files (gitignored)
├── .env                    # Environment variables (gitignored)
├── .env.example            # Environment template
├── .gitignore
├── requirements.txt        # Python dependencies
├── run.py                  # Entry point script
└── README.md
```

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd existing-projects-qa-test
```

### 2. Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/macOS:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your settings (optional - defaults work for development)
```

## Running the Server

### Development Mode

```bash
# Using the entry point script
python run.py

# Or directly with the server module
python -m src.server
```

The server will start with auto-reload enabled in development mode.

### Production Mode

Using gunicorn (recommended for production):

```bash
# Install gunicorn if not already installed
pip install gunicorn

# Start with 4 worker processes
gunicorn -w 4 -b 0.0.0.0:3000 src.app:app

# With additional options
gunicorn -w 4 -b 0.0.0.0:3000 --timeout 30 --access-logfile - src.app:app
```

Using the built-in server in production mode:

```bash
FLASK_ENV=production python run.py
```

## API Endpoints

### GET /

Returns "Hello, World!" message.

```bash
curl http://localhost:3000/
# Response: Hello, World!
```

### GET /health

Returns health status with metrics.

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-22T10:30:45.123Z",
  "uptime": 3600.25,
  "memory": {
    "rss": 52428800,
    "heapTotal": 18014208,
    "heapUsed": 9546240,
    "external": 0,
    "arrayBuffers": 0
  }
}
```

### POST /echo

Echoes the request body back to the client.

```bash
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "count": 42}'
```

Response:
```json
{
  "echo": {
    "message": "Hello",
    "count": 42
  }
}
```

### GET /info

Returns server metadata.

```bash
curl http://localhost:3000/info
```

Response:
```json
{
  "name": "hello_world",
  "version": "1.0.0",
  "description": "Flask HTTP Server",
  "pythonVersion": "3.11.0",
  "environment": "development",
  "uptime": 12345.678
}
```

### 404 Not Found

Any undefined route returns a structured error response.

```bash
curl http://localhost:3000/unknown
```

Response:
```json
{
  "status": "fail",
  "error": "NotFoundError",
  "message": "Cannot GET /unknown",
  "path": "/unknown"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | Environment mode (development/production) |
| `NODE_ENV` | `development` | Alternative environment variable (for compatibility) |
| `PORT` | `3000` | Server port number |
| `HOST` | `0.0.0.0` | Server bind address |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warning/error/critical) |

## Graceful Shutdown

The server handles the following signals for graceful shutdown:

- **SIGTERM**: Triggered by Docker stop, systemd stop, or kill command
- **SIGINT**: Triggered by Ctrl+C in terminal

Shutdown sequence:
1. Stop accepting new connections
2. Wait for active connections to complete (30-second timeout)
3. Exit cleanly with code 0
4. Force exit with code 1 if timeout expires

## Logging

Logs are written to both console and files:

- **Console**: Colored output in development, structured in production
- **logs/combined.log**: All log messages
- **logs/error.log**: Error messages only

Log files are automatically rotated at 10MB with 5 backup files.

## Security Headers

The following security headers are automatically set:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'`
- `Strict-Transport-Security` (production only)

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create logs directory
RUN mkdir -p logs

# Set environment
ENV FLASK_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Run with gunicorn
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:3000", "src.app:app"]
```

### systemd Service

Create `/etc/systemd/system/hello-world.service`:

```ini
[Unit]
Description=Hello World Flask Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/existing-projects-qa-test
Environment=FLASK_ENV=production
Environment=PORT=3000
ExecStart=/path/to/venv/bin/gunicorn -w 4 -b 0.0.0.0:3000 src.app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable hello-world
sudo systemctl start hello-world
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using the port
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows
```

### Permission Denied

Ports below 1024 require elevated permissions. Either:
- Use a port >= 1024 (recommended)
- Run with sudo (not recommended)
- Use a reverse proxy like Nginx

### Module Not Found

Ensure you're running from the project root directory:
```bash
cd /path/to/existing-projects-qa-test
python run.py
```

## Testing

```bash
# Test endpoints
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/info
curl -X POST http://localhost:3000/echo -H "Content-Type: application/json" -d '{"test": true}'
curl http://localhost:3000/nonexistent
```

## License

MIT License - see LICENSE file for details.

## Author

Migrated from Node.js by Blitzy Platform
