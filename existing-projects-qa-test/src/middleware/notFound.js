/**
 * @fileoverview Express 404 Not Found middleware.
 *
 * This module implements a catch-all middleware for handling requests to
 * undefined endpoints. It returns a structured JSON error response with
 * path information for debugging.
 *
 * This middleware should be registered after all route handlers but before
 * the general error handling middleware.
 *
 * @module middleware/notFound
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Register after routes, before error handler
 * app.use('/', routes);
 * app.use(notFound);
 * app.use(errorHandler);
 */

'use strict';

/**
 * Express middleware for handling 404 Not Found errors.
 *
 * Catches all requests that don't match any defined route and returns
 * a structured JSON response indicating the resource was not found.
 *
 * Response Format:
 * {
 *   "error": "Not Found",
 *   "message": "The requested resource was not found",
 *   "path": "/requested/path",
 *   "method": "GET",
 *   "statusCode": 404,
 *   "timestamp": "2024-12-22T14:30:00.000Z"
 * }
 *
 * @function notFound
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (unused, but required for middleware signature)
 * @returns {void}
 *
 * @example
 * // Request to undefined endpoint:
 * // GET /undefined-route
 * // Response:
 * // 404 { "error": "Not Found", "path": "/undefined-route", ... }
 */
function notFound(req, res, next) {
  // Build structured 404 response
  const errorResponse = {
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl || req.url,
    method: req.method,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  };

  // Send JSON 404 response
  res.status(404).json(errorResponse);
}

/**
 * Export the not found middleware function.
 *
 * @exports notFound
 */
module.exports = notFound;
