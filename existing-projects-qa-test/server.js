const http = require('http');
const express = require('express');

// Configuration with environment variable support
const hostname = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 3000;

// Express application, routes, and HTTP server
const app = express();
app.get('/', (req, res) => res.status(200).type('text/plain').send('Hello, World!\n'));
app.get('/good-evening', (req, res) => res.status(200).type('text/plain').send('Good evening\n'));
const server = http.createServer(app);

// Handle server-level errors (e.g., port already in use, permission denied)
server.on('error', (error) => {
  console.error('Server error:', error.message);
  
  // Provide specific guidance for common errors
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${port}`);
  }
  
  process.exit(1);
});

// Handle client connection errors
server.on('clientError', (error, socket) => {
  console.error('Client connection error:', error.message);
  
  // Send HTTP 400 response if socket is still writable
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } else {
    socket.destroy();
  }
});

// Graceful shutdown function with timeout
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed. All connections finished.');
    process.exit(0);
  });
  
  // Force shutdown after timeout if connections don't close naturally
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions (last resort error handler)
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', error.name, error.message);
  console.error('Stack:', error.stack);
  
  // Attempt graceful shutdown, then force exit
  server.close(() => {
    console.log('Server closed due to uncaught exception');
    process.exit(1);
  });
  
  // Force exit if server doesn't close in time
  setTimeout(() => {
    console.error('Forcing exit after uncaught exception');
    process.exit(1);
  }, 5000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION! Shutting down...');
  console.error('Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Treat unhandled rejections as critical errors
  server.close(() => {
    console.log('Server closed due to unhandled rejection');
    process.exit(1);
  });
  
  // Force exit if server doesn't close in time
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
