/**
 * @fileoverview Express centralized error handling middleware.
 *
 * This module implements the Express 4-argument error middleware pattern for
 * centralized error handling. It provides structured JSON error responses with
 * environment-aware stack trace handling (hidden in production, shown in development).
 *
 * Migrated from the original server.js error handling patterns (lines 91-102)
 * to the Express middleware pattern.
 *
 * @module middleware/errorHandler
 * @requires config
 * @requires utils/logger
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Register as LAST middleware in Express app
 * const errorHandler = require('./middleware/errorHandler');
 * app.use(errorHandler);
 *
 * @see {@link https://expressjs.com/en/guide/error-handling.html|Express Error Handling}
 */

'use strict';

const config = require('../config');
const logger = require('../utils/logger');

/**
 * Express error handling middleware function.
 *
 * Implements the Express 4-argument error handler pattern. Catches all errors
 * thrown or passed via next(error) in the middleware chain and returns a
 * structured JSON error response.
 *
 * Response Format:
 * {
 *   "error": "Error Name",
 *   "message": "Error message description",
 *   "stack": "Stack trace (development only)",
 *   "statusCode": 500,
 *   "path": "/requested/path",
 *   "timestamp": "2024-12-22T14:30:00.000Z"
 * }
 *
 * @function errorHandler
 * @param {Error} err - Error object thrown or passed to next()
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (required for 4-arg signature)
 * @returns {void}
 *
 * @example
 * // In a route handler, throw an error or pass to next:
 * app.get('/error', (req, res, next) => {
 *   next(new Error('Something went wrong'));
 * });
 */
function errorHandler(err, req, res, next) {
  // Determine status code from error or default to 500
  const statusCode = err.statusCode || err.status || 500;

  // Log the error with appropriate level based on status code
  const logMethod = statusCode >= 500 ? 'error' : 'warn';
  logger[logMethod]('Error caught in errorHandler', {
    error: err.name || 'Error',
    message: err.message,
    statusCode,
    path: req.originalUrl || req.url,
    method: req.method,
    stack: err.stack,
  });

  // Prevent duplicate responses if headers already sent
  // Motive: Prevent "Cannot set headers after they are sent" errors
  if (res.headersSent) {
    return next(err);
  }

  // Build error response object
  const errorResponse = {
    error: err.name || 'Error',
    message: err.message || 'Internal Server Error',
    statusCode,
    path: req.originalUrl || req.url,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace only in development for debugging
  // Motive: Hide implementation details from clients in production
  if (config.isDevelopment) {
    errorResponse.stack = err.stack;
  }

  // Send JSON error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Export the error handler middleware function.
 *
 * @exports errorHandler
 */
module.exports = errorHandler;
