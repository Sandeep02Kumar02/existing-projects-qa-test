const express = require('express');
const app = express();

// Configuration with environment variable support for production flexibility
// Motive: Allow deployment-time configuration without code changes, following 12-factor app principles
const hostname = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 3000;

// Route handler for Hello World endpoint
// Motive: Maintain existing functionality with Express.js routing
app.get('/', (req, res) => {
  res.status(200).set('Content-Type', 'text/plain').send('Hello, World!\n');
});

// Route handler for Good Evening endpoint (NEW)
// Motive: Add new endpoint as per feature requirements
app.get('/evening', (req, res) => {
  res.status(200).set('Content-Type', 'text/plain').send('Good evening\n');
});

// Error handling middleware (must be registered after routes)
// Motive: Prevent request processing errors from crashing the entire server process
// Replaces try-catch error boundaries from original implementation
app.use((err, req, res, next) => {
  // Handle any synchronous errors in request processing
  // Motive: Contain errors within request scope, log for debugging, return 500 to client
  console.error('Error processing request:', err);
  
  // Only send error response if headers haven't been sent
  // Motive: Prevent "Cannot set headers after they are sent" errors
  if (!res.headersSent) {
    res.status(500).set('Content-Type', 'text/plain').send('Internal Server Error\n');
  }
});

// Server instance will be created by app.listen() below
let server;

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

// Handle graceful shutdown signals
// Motive: Support standard Unix process management (kill, systemd, Docker, Kubernetes)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

// Start the server with Express
// Motive: app.listen() returns the underlying http.Server instance for event handlers and graceful shutdown
server = app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log('Press Ctrl+C to stop the server');
});

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
