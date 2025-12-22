/**
 * @fileoverview Express.js server bootstrap with graceful shutdown.
 *
 * This module creates the HTTP server from the Express application, handles
 * process signals (SIGTERM, SIGINT), and manages connection draining.
 * Preserves the original graceful shutdown behavior from the native Node.js
 * implementation while adapting it for Express.js.
 *
 * CRITICAL: dotenv.config() is called at the very beginning before any other
 * imports to ensure environment variables are available throughout the application.
 *
 * Migrated from the original server.js with preserved patterns:
 * - 30-second shutdown timeout (per Agent Action Plan)
 * - Signal handling (SIGTERM, SIGINT)
 * - Uncaught exception handling with 5-second forced exit
 * - Unhandled rejection handling with 5-second forced exit
 *
 * @module server
 * @requires dotenv
 * @requires app
 * @requires config
 * @requires utils/logger
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Start the server:
 * // node src/server.js
 * // or
 * // npm start
 */

'use strict';

// CRITICAL: Load environment variables FIRST before any other imports
// This ensures all modules have access to environment variables from .env file
require('dotenv').config();

const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

/**
 * HTTP server instance.
 * Created from Express application for graceful shutdown support.
 * @type {http.Server}
 */
const server = http.createServer(app);

/**
 * Shutdown state flag to prevent multiple shutdown attempts.
 * @type {boolean}
 */
let isShuttingDown = false;

/**
 * Shutdown timeout in milliseconds.
 * Increased from original 10s to 30s per Agent Action Plan Section 0.7.1.
 * @const {number}
 */
const SHUTDOWN_TIMEOUT = 30000;

/**
 * Exception shutdown timeout in milliseconds.
 * Forces exit after 5 seconds on uncaught exceptions or unhandled rejections.
 * @const {number}
 */
const EXCEPTION_TIMEOUT = 5000;

/**
 * Initiates graceful server shutdown with connection draining.
 *
 * Stops accepting new connections, waits for existing connections to complete,
 * and exits cleanly. Forces shutdown after SHUTDOWN_TIMEOUT if connections
 * don't drain naturally.
 *
 * Preserves the original graceful shutdown behavior from server.js lines 183-199.
 *
 * @function gracefulShutdown
 * @param {string} signal - OS signal that triggered shutdown (SIGTERM or SIGINT)
 * @returns {void}
 *
 * @description
 * Shutdown Sequence:
 * 1. Stop accepting new connections (server.close())
 * 2. Wait for active connections to finish naturally
 * 3. Exit with code 0 if all connections close within timeout
 * 4. Force exit with code 1 if timeout expires (hung connections)
 */
function gracefulShutdown(signal) {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  isShuttingDown = true;

  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  // Motive: Drain existing connections while rejecting new ones
  server.close(() => {
    logger.info('Server closed. All connections finished.');
    process.exit(0);
  });

  // Force shutdown after timeout if connections don't close naturally
  // Motive: Prevent hung processes if connections don't drain within reasonable time
  const forceShutdownTimer = setTimeout(() => {
    logger.error('Forcing shutdown after timeout - connections did not drain');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  // Prevent the timer from keeping the process alive if server closes naturally
  forceShutdownTimer.unref();
}

/**
 * Start the HTTP server.
 *
 * Binds to the configured host and port and logs startup information.
 *
 * @function startServer
 * @returns {void}
 */
function startServer() {
  server.listen(config.port, config.host, () => {
    logger.info(`Server running at http://${config.host}:${config.port}/`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Log level: ${config.logLevel}`);
    logger.info('Press Ctrl+C to stop the server');
  });
}

// =============================================================================
// Server Error Handler
// =============================================================================

/**
 * Server error event handler for binding failures.
 *
 * Handles server-level errors like port conflicts (EADDRINUSE) or permission
 * issues (EACCES). Logs specific guidance and exits process with status 1.
 *
 * Migrated from original server.js lines 121-133.
 *
 * @listens Server#error
 * @param {Error} error - Server error with code property
 */
server.on('error', (error) => {
  logger.error('Server error:', { message: error.message, code: error.code });

  // Provide specific guidance for common errors
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use. Try a different port or stop the other process.`);
  } else if (error.code === 'EACCES') {
    logger.error(`Permission denied to bind to port ${config.port}. Use a port >= 1024 or run with elevated permissions.`);
  }

  process.exit(1);
});

// =============================================================================
// Process Signal Handlers
// =============================================================================

/**
 * SIGTERM signal handler for graceful shutdown.
 * Triggered by Docker stop, systemd service stop, or kill command.
 * @listens process#SIGTERM
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * SIGINT signal handler for graceful shutdown.
 * Triggered by Ctrl+C in terminal or kill -2 command.
 * @listens process#SIGINT
 */
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================================================
// Process Error Handlers
// =============================================================================

/**
 * Uncaught exception handler (last resort error handler).
 *
 * Logs full error details including stack trace and attempts graceful shutdown.
 * Forces exit after EXCEPTION_TIMEOUT if shutdown doesn't complete.
 * Per Node.js best practices, do not continue execution after uncaught exception.
 *
 * Migrated from original server.js lines 228-246.
 *
 * @listens process#uncaughtException
 * @param {Error} error - Uncaught exception
 */
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
    error: error.name,
    message: error.message,
    stack: error.stack,
  });

  // Attempt graceful shutdown, then force exit
  server.close(() => {
    logger.info('Server closed due to uncaught exception');
    process.exit(1);
  });

  // Force exit if server doesn't close in time
  setTimeout(() => {
    logger.error('Forcing exit after uncaught exception');
    process.exit(1);
  }, EXCEPTION_TIMEOUT);
});

/**
 * Unhandled promise rejection handler for async errors.
 *
 * Catches promise rejections that don't have .catch() handlers.
 * Treats as critical error and initiates graceful shutdown.
 * Forces exit after EXCEPTION_TIMEOUT if shutdown doesn't complete.
 *
 * Migrated from original server.js lines 261-279.
 *
 * @listens process#unhandledRejection
 * @param {*} reason - Promise rejection reason
 * @param {Promise} promise - Promise that was rejected
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED PROMISE REJECTION! Shutting down...', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });

  // Treat unhandled rejections as critical errors
  server.close(() => {
    logger.info('Server closed due to unhandled rejection');
    process.exit(1);
  });

  // Force exit if server doesn't close in time
  setTimeout(() => {
    logger.error('Forcing exit after unhandled rejection');
    process.exit(1);
  }, EXCEPTION_TIMEOUT);
});

// =============================================================================
// Start Server
// =============================================================================

// Start the server
startServer();

/**
 * Export gracefulShutdown for testing purposes.
 *
 * @exports gracefulShutdown
 */
module.exports = { gracefulShutdown };
