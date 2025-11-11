/**
 * @fileoverview Production-hardened HTTP server with comprehensive error handling, graceful shutdown, and input validation.
 * 
 * This module implements a minimal Node.js HTTP server with zero external dependencies, focusing on production reliability
 * through comprehensive error handling, graceful shutdown support, and defensive input validation.
 * 
 * @module server
 * @requires http
 * @author hxu
 * @license MIT
 * @see {@link https://nodejs.org/api/http.html|Node.js HTTP Documentation}
 */

const http = require('http');

/**
 * Server bind address, configurable via HOST environment variable.
 * Defaults to 127.0.0.1 (localhost only) for development security.
 * Use HOST=0.0.0.0 for production to accept connections from all network interfaces.
 * 
 * @const {string}
 * @default '127.0.0.1'
 * @example
 * // Development (default)
 * node server.js
 * 
 * @example
 * // Production
 * HOST=0.0.0.0 node server.js
 */
// Configuration with environment variable support for production flexibility
// Motive: Allow deployment-time configuration without code changes, following 12-factor app principles
const hostname = process.env.HOST || '127.0.0.1';

/**
 * Server bind port, configurable via PORT environment variable.
 * Defaults to 3000 for development. Ports 1-1024 require elevated permissions.
 * 
 * @const {number}
 * @default 3000
 * @example
 * PORT=8080 node server.js
 */
const port = process.env.PORT || 3000;

/**
 * HTTP request handler with input validation and error containment.
 * 
 * Handles all HTTP requests by validating required properties (method, url) and returning
 * "Hello, World!" response. Implements try/catch error boundary to prevent server crashes.
 * 
 * @function
 * @param {http.IncomingMessage} req - HTTP request object with method, url, headers properties
 * @param {http.ServerResponse} res - HTTP response object for sending status and body
 * @returns {void}
 * 
 * @throws Will not throw - all errors caught and converted to 500 response
 * 
 * @example
 * // Successful request
 * curl http://127.0.0.1:3000/
 * // Returns: "Hello, World!"
 * 
 * @example
 * // Invalid request (missing method/url)
 * // Returns: 400 "Bad Request: Invalid request format"
 * 
 * @description
 * Response Codes:
 * - 200: Success - returns "Hello, World!\n"
 * - 400: Bad Request - req.method or req.url missing
 * - 500: Internal Server Error - uncaught exception during processing
 */
// Request handler with proper error handling
// Motive: Prevent request processing errors from crashing the entire server process
const server = http.createServer((req, res) => {
  try {
    // Input validation: Ensure request method and URL are present
    // Motive: Prevent null reference errors when accessing request properties
    if (!req.method || !req.url) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Bad Request: Invalid request format\n');
      return;
    }

    // Normal request processing
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
  } catch (error) {
    // Handle any synchronous errors in request processing
    // Motive: Contain errors within request scope, log for debugging, return 500 to client
    console.error('Error processing request:', error);
    
    // Only send error response if headers haven't been sent
    // Motive: Prevent "Cannot set headers after they are sent" errors
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error\n');
    }
  }
});

/**
 * Server error event handler for binding failures.
 * 
 * Handles server-level errors like port conflicts (EADDRINUSE) or permission issues (EACCES).
 * Logs specific guidance and exits process with status 1.
 * 
 * @listens Server#error
 * @param {Error} error - Server error with code property (EADDRINUSE, EACCES, etc.)
 * @example
 * // Common errors:
 * // EADDRINUSE: Another process using the port - change port or kill process
 * // EACCES: Privileged port without permissions - use port >=1024 or elevate
 */
// Handle server-level errors (e.g., port already in use, permission denied)
// Motive: Prevent unhandled server binding failures from crashing process with unclear error messages
server.on('error', (error) => {
  console.error('Server error:', error.message);
  
  // Provide specific guidance for common errors
  // Motive: Help operators quickly identify and resolve deployment issues
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${port}`);
  }
  
  process.exit(1);
});

/**
 * Client error event handler for malformed requests.
 * 
 * Handles errors from malformed HTTP requests or client connection issues.
 * Sends 400 response if socket writable, otherwise destroys socket.
 * 
 * @listens Server#clientError
 * @param {Error} error - Client connection error
 * @param {net.Socket} socket - Socket that experienced the error, may not be writable
 */
// Handle client connection errors
// Motive: Prevent malformed requests or client errors from leaking sockets or crashing server
server.on('clientError', (error, socket) => {
  console.error('Client connection error:', error.message);
  
  // Send HTTP 400 response if socket is still writable
  // Motive: Inform client of error condition before closing connection
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } else {
    socket.destroy();
  }
});

/**
 * Initiates graceful server shutdown with connection draining.
 * 
 * Stops accepting new connections, waits for existing connections to complete,
 * and exits cleanly. Forces shutdown after 10-second timeout if connections don't drain.
 * 
 * @function
 * @param {string} signal - OS signal that triggered shutdown (SIGTERM or SIGINT)
 * @returns {void}
 * 
 * @description
 * Shutdown Sequence:
 * 1. Stop accepting new connections (server.close())
 * 2. Wait for active connections to finish naturally
 * 3. Exit with code 0 if all connections close within 10 seconds
 * 4. Force exit with code 1 if timeout expires (hung connections)
 * 
 * @example
 * // Triggered by:
 * // - SIGTERM: Docker stop, systemd stop, kill <PID>
 * // - SIGINT: Ctrl+C in terminal
 */
// Graceful shutdown function with timeout
// Motive: Ensure in-flight requests complete before shutdown, preventing client errors during deployments
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  // Motive: Drain existing connections while rejecting new ones
  server.close(() => {
    console.log('Server closed. All connections finished.');
    process.exit(0);
  });
  
  // Force shutdown after timeout if connections don't close naturally
  // Motive: Prevent hung processes if connections don't drain within reasonable time
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout
}

/**
 * SIGTERM signal handler for graceful shutdown.
 * Triggered by Docker stop, systemd service stop, or kill command.
 * @listens process#SIGTERM
 */
/**
 * SIGINT signal handler for graceful shutdown.
 * Triggered by Ctrl+C in terminal or kill -2 command.
 * @listens process#SIGINT
 */
// Handle graceful shutdown signals
// Motive: Support standard Unix process management (kill, systemd, Docker, Kubernetes)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Uncaught exception handler (last resort error handler).
 * 
 * Logs full error details including stack trace and attempts graceful shutdown.
 * Forces exit after 5 seconds if shutdown doesn't complete.
 * Per Node.js best practices, do not continue execution after uncaught exception.
 * 
 * @listens process#uncaughtException
 * @param {Error} error - Uncaught exception with name, message, and stack properties
 */
// Handle uncaught exceptions (last resort error handler)
// Motive: Log unexpected errors and attempt graceful shutdown instead of silent crash
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', error.name, error.message);
  console.error('Stack:', error.stack);
  
  // Attempt graceful shutdown, then force exit
  // Motive: Per Node.js best practices, do not continue after uncaught exception
  server.close(() => {
    console.log('Server closed due to uncaught exception');
    process.exit(1);
  });
  
  // Force exit if server doesn't close in time
  // Motive: Prevent hung process in corrupted state
  setTimeout(() => {
    console.error('Forcing exit after uncaught exception');
    process.exit(1);
  }, 5000);
});

/**
 * Unhandled promise rejection handler for async errors.
 * 
 * Catches promise rejections that don't have .catch() handlers.
 * Treats as critical error and initiates graceful shutdown.
 * Forces exit after 5 seconds if shutdown doesn't complete.
 * 
 * @listens process#unhandledRejection
 * @param {*} reason - Promise rejection reason (can be any type)
 * @param {Promise} promise - Promise that was rejected
 */
// Handle unhandled promise rejections
// Motive: Catch async errors that slip through without .catch() handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION! Shutting down...');
  console.error('Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Treat unhandled rejections as critical errors
  // Motive: Prevent silent failures and data corruption from unhandled async errors
  server.close(() => {
    console.log('Server closed due to unhandled rejection');
    process.exit(1);
  });
  
  // Force exit if server doesn't close in time
  // Motive: Ensure process doesn't hang in undefined state
  setTimeout(() => {
    console.error('Forcing exit after unhandled rejection');
    process.exit(1);
  }, 5000);
});

// Start the server
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log('Press Ctrl+C to stop the server');
});
