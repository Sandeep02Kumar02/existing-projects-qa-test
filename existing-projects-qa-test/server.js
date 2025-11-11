const http = require('http');

/**
 * Server bind address configured via HOST environment variable.
 * @constant {string}
 * @default '127.0.0.1'
 * @description Hostname the server will bind to. Defaults to localhost (127.0.0.1) for security.
 * Set to '0.0.0.0' in production to accept connections from all network interfaces.
 * @example
 * // Bind to all interfaces
 * // HOST=0.0.0.0 node server.js
 */
// Configuration with environment variable support for production flexibility
// Motive: Allow deployment-time configuration without code changes, following 12-factor app principles
const hostname = process.env.HOST || '127.0.0.1';
/**
 * Server listen port configured via PORT environment variable.
 * @constant {number}
 * @default 3000
 * @description Port number the server will listen on. Defaults to 3000.
 * Ports below 1024 require elevated privileges on Unix systems.
 * @example
 * // Use custom port
 * // PORT=8080 node server.js
 */
const port = process.env.PORT || 3000;

/**
 * HTTP request handler that processes all incoming requests.
 * @param {http.IncomingMessage} req - The incoming HTTP request object
 * @param {http.ServerResponse} res - The HTTP response object for sending responses
 * @returns {void}
 * @throws {Error} Catches all synchronous errors and returns 500 response; prevents request errors from crashing server
 * @description Validates request format (requires req.method and req.url), returns "Hello, World!" for all valid requests.
 * Implements comprehensive error handling to contain errors within request scope.
 * @example
 * // All HTTP methods and paths return the same response
 * // GET http://127.0.0.1:3000/ → 200 "Hello, World!"
 * // POST http://127.0.0.1:3000/any/path → 200 "Hello, World!"
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
 * Handles server-level errors during initialization or binding.
 * @listens server#error
 * @param {Error} error - The error object containing error code and message
 * @description Provides specific guidance for common deployment errors and exits process with code 1.
 * Common error codes: EADDRINUSE (port already in use), EACCES (permission denied for privileged port).
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
 * Handles client connection errors and malformed requests.
 * @listens server#clientError
 * @param {Error} error - The error from client connection
 * @param {net.Socket} socket - The socket connection to the client
 * @description Sends HTTP 400 response if socket is writable, otherwise destroys socket.
 * Prevents socket leaks and malformed requests from crashing server.
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
 * Initiates graceful shutdown of the HTTP server.
 * @function
 * @param {string} signal - The process signal that triggered shutdown (SIGTERM, SIGINT)
 * @returns {void}
 * @description Stops accepting new connections and waits up to 10 seconds for existing connections to complete.
 * Forces process exit if connections don't drain naturally. Ensures zero-downtime deployments by allowing
 * in-flight requests to finish.
 * @example
 * // Trigger graceful shutdown
 * // kill -SIGTERM <pid>
 * @see README.md#operations for production shutdown procedures
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
 * Handles graceful shutdown signals for process management.
 * @listens process#SIGTERM - Standard Unix process termination signal (systemd, Docker, Kubernetes)
 * @listens process#SIGINT - Interactive termination signal (Ctrl+C)
 * @description Both signals trigger gracefulShutdown function to allow in-flight requests to complete.
 */
// Handle graceful shutdown signals
// Motive: Support standard Unix process management (kill, systemd, Docker, Kubernetes)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Last-resort error handler for uncaught exceptions.
 * @listens process#uncaughtException
 * @param {Error} error - The uncaught exception error object
 * @description Logs detailed error information including stack trace, attempts graceful server shutdown,
 * and forces exit after 5 seconds if shutdown hangs. Per Node.js best practices, application should not
 * continue after uncaught exception as process may be in corrupted state.
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
 * Handles unhandled promise rejections (async errors without .catch() handlers).
 * @listens process#unhandledRejection
 * @param {any} reason - The rejection reason (error or any value)
 * @param {Promise} promise - The promise that was rejected
 * @description Treats unhandled rejections as critical errors. Logs rejection details, attempts graceful
 * shutdown, and forces exit after 5 seconds. Prevents silent failures and data corruption from unhandled
 * async errors.
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
