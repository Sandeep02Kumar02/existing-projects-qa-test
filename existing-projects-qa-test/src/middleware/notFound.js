/**
 * @fileoverview Express 404 Not Found middleware for undefined endpoints.
 * 
 * This middleware acts as a catch-all route that intercepts requests which don't
 * match any defined routes in the Express application. It must be placed after
 * all route handlers but before the error handling middleware in the middleware
 * chain.
 * 
 * Replaces the implicit 404 handling from the original native HTTP server
 * implementation with a structured JSON response format.
 * 
 * Middleware Order (per Section 0.5.4):
 * 1. Security (helmet)
 * 2. CORS
 * 3. Compression
 * 4. Body Parser
 * 5. Request Logger (Morgan)
 * 6. Routes
 * 7. notFound (this middleware) <-- HERE
 * 8. errorHandler
 * 
 * @module middleware/notFound
 * @author Blitzy Platform
 * @license MIT
 * 
 * @example
 * // Register after routes, before error handler
 * const express = require('express');
 * const notFound = require('./middleware/notFound');
 * const errorHandler = require('./middleware/errorHandler');
 * 
 * const app = express();
 * 
 * // ... route definitions ...
 * 
 * app.use(notFound);      // 404 handler - after routes
 * app.use(errorHandler);  // Error handler - after notFound
 */

'use strict';

/**
 * Express middleware for handling 404 Not Found errors.
 * 
 * Catches all requests that don't match any defined route and returns
 * a structured JSON response indicating the resource was not found.
 * 
 * This middleware sends the response directly (for simplicity and performance)
 * rather than creating an error and passing it to the error handler.
 * 
 * Response Format:
 * {
 *   "status": "fail",
 *   "error": "NotFound",
 *   "message": "Cannot GET /unknown-path",
 *   "path": "/unknown-path"
 * }
 * 
 * @function notFound
 * @param {Object} req - Express request object
 * @param {string} req.method - HTTP method (GET, POST, etc.)
 * @param {string} req.originalUrl - Original request URL path
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (unused, required for middleware signature)
 * @returns {void} Sends JSON response directly, does not call next()
 * 
 * @example
 * // Request to undefined endpoint:
 * // GET /unknown-route
 * //
 * // Response (404):
 * // {
 * //   "status": "fail",
 * //   "error": "NotFound",
 * //   "message": "Cannot GET /unknown-route",
 * //   "path": "/unknown-route"
 * // }
 * 
 * @example
 * // POST to undefined endpoint:
 * // POST /api/nonexistent
 * //
 * // Response (404):
 * // {
 * //   "status": "fail",
 * //   "error": "NotFound",
 * //   "message": "Cannot POST /api/nonexistent",
 * //   "path": "/api/nonexistent"
 * // }
 */
function notFound(req, res, next) {
  // Get the HTTP method and original URL from the request
  // req.originalUrl preserves the original path even if the request
  // has been through sub-routers that modified req.url
  const method = req.method;
  const path = req.originalUrl;

  // Build structured 404 error response object
  // - status: 'fail' indicates a client error (4xx status codes)
  // - error: 'NotFound' is the error type identifier
  // - message: Descriptive message including the HTTP method and attempted path
  // - path: The attempted path for debugging/logging purposes
  const errorResponse = {
    status: 'fail',
    error: 'NotFound',
    message: `Cannot ${method} ${path}`,
    path: path
  };

  // Send JSON response with 404 status code
  // Direct response is preferred over next(error) for:
  // 1. Simplicity - no need to create Error object
  // 2. Performance - avoids extra middleware hop
  // 3. Clarity - 404 handling is self-contained
  res.status(404).json(errorResponse);
}

/**
 * Export the notFound middleware function as the default export.
 * 
 * @exports notFound
 * @type {Function}
 */
module.exports = notFound;
