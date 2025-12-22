/**
 * @fileoverview Centralized Express.js error handling middleware module.
 *
 * This module implements the Express 4-argument error middleware pattern for
 * centralized error handling. It provides structured JSON error responses with
 * environment-aware stack trace handling (hidden in production, shown in development).
 *
 * Migrated from the original server.js error handling patterns (lines 91-103)
 * to the Express middleware pattern. Replaces the manual try-catch error handling
 * with Express-standard error middleware that should be registered LAST in the
 * middleware chain.
 *
 * Key Features:
 * - Structured JSON error responses with consistent format
 * - Environment-aware error detail (full details in development, sanitized in production)
 * - Stack trace inclusion controlled by NODE_ENV
 * - Proper handling of headersSent state to prevent duplicate responses
 * - Comprehensive error logging via Winston logger
 *
 * @module middleware/errorHandler
 * @requires ../config
 * @requires ../utils/logger
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Register as LAST middleware in Express app
 * const errorHandler = require('./middleware/errorHandler');
 * app.use(errorHandler);
 *
 * @example
 * // Throwing errors in routes
 * app.get('/error', (req, res, next) => {
 *   const error = new Error('Something went wrong');
 *   error.statusCode = 400;
 *   error.status = 'fail';
 *   next(error);
 * });
 *
 * @see {@link https://expressjs.com/en/guide/error-handling.html|Express Error Handling}
 */

'use strict';

// =============================================================================
// IMPORTS
// =============================================================================

/**
 * Centralized environment configuration providing isDevelopment flag
 * to determine whether to include full stack traces in error responses.
 * In development mode, includes stack traces for debugging; in production
 * mode, sanitizes error messages to prevent information leakage.
 */
const config = require('../config');

/**
 * Winston logger instance for structured error logging.
 * Used to log error details with logger.error() replacing the
 * console.error('Error processing request:', error) pattern from
 * original server.js line 94. Provides consistent formatting and
 * multiple transport outputs (console, file) for error tracking.
 */
const logger = require('../utils/logger');

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Generic error message used in production to prevent information leakage.
 * @const {string}
 */
const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.';

/**
 * Default error name when error object lacks a name property.
 * @const {string}
 */
const DEFAULT_ERROR_NAME = 'InternalServerError';

/**
 * Default error status string.
 * @const {string}
 */
const DEFAULT_ERROR_STATUS = 'error';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determines if an error message is safe to expose to clients.
 * Only exposes messages for client errors (4xx) and hides server error details.
 *
 * @param {number} statusCode - HTTP status code of the error
 * @param {Error} err - The error object
 * @returns {boolean} True if the message is safe to expose
 * @private
 */
function isClientError(statusCode) {
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Sanitizes error message based on environment and error type.
 * In production, only client error messages (4xx) are exposed.
 * Server errors (5xx) always show a generic message in production.
 *
 * @param {Error} err - The error object
 * @param {number} statusCode - HTTP status code of the error
 * @returns {string} Sanitized error message safe for client response
 * @private
 */
function sanitizeErrorMessage(err, statusCode) {
  // In development, always show the actual error message
  if (config.isDevelopment) {
    return err.message || GENERIC_ERROR_MESSAGE;
  }

  // In production, only show client error messages (4xx)
  // Server errors (5xx) should not expose implementation details
  if (isClientError(statusCode) && err.message) {
    return err.message;
  }

  // For server errors in production, return generic message
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Determines the appropriate error name/type for the response.
 *
 * @param {Error} err - The error object
 * @param {number} statusCode - HTTP status code of the error
 * @returns {string} Error name/type for the response
 * @private
 */
function getErrorName(err, statusCode) {
  // Use error name if available
  if (err.name && err.name !== 'Error') {
    return err.name;
  }

  // Map common status codes to error names
  const statusCodeNames = {
    400: 'BadRequestError',
    401: 'UnauthorizedError',
    403: 'ForbiddenError',
    404: 'NotFoundError',
    405: 'MethodNotAllowedError',
    409: 'ConflictError',
    422: 'UnprocessableEntityError',
    429: 'TooManyRequestsError',
    500: 'InternalServerError',
    502: 'BadGatewayError',
    503: 'ServiceUnavailableError',
    504: 'GatewayTimeoutError',
  };

  return statusCodeNames[statusCode] || DEFAULT_ERROR_NAME;
}

// =============================================================================
// ERROR HANDLER MIDDLEWARE
// =============================================================================

/**
 * Express error handling middleware function.
 *
 * Implements the Express 4-argument error handler pattern. This middleware
 * catches all errors thrown or passed via next(error) in the middleware chain
 * and returns a structured JSON error response.
 *
 * This middleware replaces the manual error handling try-catch patterns from
 * the original server.js (lines 91-103) with Express-standard error middleware.
 *
 * Response Format:
 * {
 *   "status": "error",
 *   "error": "InternalServerError",
 *   "message": "Something went wrong",
 *   "stack": "..." (development only),
 *   "path": "/api/endpoint"
 * }
 *
 * Features:
 * - Uses err.statusCode or err.status for HTTP status code (defaults to 500)
 * - Uses err.status string for response status field (defaults to 'error')
 * - Logs errors using logger.error() with full context
 * - Checks res.headersSent to prevent duplicate responses
 * - Sanitizes error messages in production (no stack traces, generic messages)
 * - Includes full error details in development for debugging
 *
 * @function errorHandler
 * @param {Error} err - Error object thrown or passed to next()
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (required for 4-arg signature)
 * @returns {void}
 *
 * @example
 * // Throwing a standard error
 * app.get('/api/data', (req, res, next) => {
 *   try {
 *     // Some operation that might fail
 *   } catch (error) {
 *     next(error); // Passes to errorHandler
 *   }
 * });
 *
 * @example
 * // Creating a custom error with status code
 * const error = new Error('Resource not found');
 * error.statusCode = 404;
 * error.status = 'fail';
 * next(error);
 */
function errorHandler(err, req, res, next) {
  // Determine HTTP status code from error properties or default to 500
  // Supports both statusCode (express convention) and status (http-errors convention)
  const statusCode = err.statusCode || err.status || 500;

  // Determine the status string for the response
  // Use err.status if it's a string, otherwise default to 'error'
  const status = typeof err.status === 'string' ? err.status : DEFAULT_ERROR_STATUS;

  // Get the appropriate error name/type
  const errorName = getErrorName(err, statusCode);

  // Sanitize the error message based on environment and error type
  const message = sanitizeErrorMessage(err, statusCode);

  // Log the error with comprehensive context for debugging and monitoring
  // Replaces console.error('Error processing request:', error) from original server.js line 94
  logger.error('Error processing request', {
    error: errorName,
    message: err.message, // Log original message for internal debugging
    statusCode,
    status,
    path: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    stack: err.stack,
  });

  // Prevent duplicate responses if headers have already been sent
  // This preserves the pattern from original server.js line 98:
  // if (!res.headersSent) { ... }
  // Motive: Prevent "Cannot set headers after they are sent to the client" errors
  if (res.headersSent) {
    // Delegate to Express default error handler
    return next(err);
  }

  // Build structured JSON error response object
  // Format specified in Agent Action Plan Section 0.3.2 and Section 0.7.2
  const errorResponse = {
    status,
    error: errorName,
    message,
    path: req.originalUrl || req.url,
  };

  // Include stack trace ONLY in development mode for debugging
  // In production mode, sanitize error messages to prevent information leakage
  // per security requirements in Agent Action Plan Section 0.5.6
  if (config.isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send JSON error response with appropriate status code
  res.status(statusCode).json(errorResponse);
}

// =============================================================================
// MODULE EXPORT
// =============================================================================

/**
 * Export the error handler middleware function as the default export.
 *
 * This middleware should be registered as the LAST middleware in the
 * Express application to catch all errors from preceding middleware and routes.
 *
 * @exports errorHandler
 * @type {Function}
 *
 * @example
 * // In src/app.js
 * const errorHandler = require('./middleware/errorHandler');
 *
 * // Register routes first
 * app.use('/api', apiRoutes);
 *
 * // Register error handler LAST
 * app.use(errorHandler);
 */
module.exports = errorHandler;
