const http = require('http');
// Express.js web framework for routing and middleware
// Motive: Express adds declarative routing and middleware on top of Node's http module, while http is still
// needed to create and own the server instance whose lifecycle (events, listen, graceful shutdown) is managed below
const express = require('express');

// Configuration with environment variable support for production flexibility
// Motive: Allow deployment-time configuration without code changes, following 12-factor app principles
const hostname = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 3000;

// Create Express application
// Motive: express() returns an app that is itself a request handler function; it collects routes and
// middleware and runs them in registration order for every incoming request
const app = express();

// Route: Original "Hello world" endpoint
// Motive: Express routes follow the app.METHOD(path, handler) pattern (here GET on '/'); the handler receives
// Node's req/res objects enhanced with Express helpers such as res.status(), res.type() and res.send()
app.get('/', (req, res) => {
  // Respond with status 200 and an explicit text/plain content type
  // Motive: res.send() with a string defaults to text/html, so .type('text/plain') keeps the original response format
  res.status(200).type('text/plain').send('Hello, World!\n');
});

// Route: New "Good evening" endpoint
// Motive: Every additional endpoint is one more app.METHOD(path, handler) call; paths without a route
// fall through to Express's built-in 404 response
app.get('/evening', (req, res) => {
  res.status(200).type('text/plain').send('Good evening\n');
});

// Express error handling middleware (must be after all routes)
// Motive: Express recognises error handlers by their four arguments (err, req, res, next), so the unused next
// must stay in the signature; registered last, it receives errors thrown by any route above (Express 5 also
// forwards rejected promises from async handlers here), replacing the old per-request try/catch
app.use((err, req, res, next) => {
  console.error('Error processing request:', err);

  // Only send error response if headers haven't been sent
  // Motive: Prevent "Cannot set headers after they are sent" errors
  if (!res.headersSent) {
    res.status(500).type('text/plain').send('Internal Server Error\n');
  }
});

// Create HTTP server from Express app
// Motive: An Express app is a valid (req, res) callback for http.createServer; using it instead of app.listen()
// keeps an explicit server instance, so the server event handlers, graceful shutdown and server.listen() below
// keep working unchanged
const server = http.createServer(app);

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

// Start the server
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log('Press Ctrl+C to stop the server');
});
