/**
 * @fileoverview Morgan HTTP request logging middleware with Winston integration.
 *
 * This module configures Morgan for HTTP request logging and streams the output
 * through Winston for unified logging. It provides different formats for
 * development (colored, detailed) and production (combined, structured) environments.
 *
 * @module middleware/requestLogger
 * @requires morgan
 * @requires config
 * @requires utils/logger
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * const { requestLogger } = require('./middleware/requestLogger');
 * app.use(requestLogger);
 *
 * @see {@link https://github.com/expressjs/morgan|Morgan Documentation}
 */

'use strict';

const morgan = require('morgan');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Custom Morgan token for response time in milliseconds.
 * Uses built-in response-time token format.
 */
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '-';
  }
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

/**
 * Development log format - detailed and readable for debugging.
 * Includes method, URL, status, response time, and content length.
 *
 * Example output:
 * GET /health 200 12.345 ms - 156
 */
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

/**
 * Production log format - Apache combined format for structured logging.
 * Includes remote address, user, method, URL, protocol, status, content length,
 * referrer, and user agent.
 *
 * Example output:
 * ::1 - - [22/Dec/2024:14:30:00 +0000] "GET /health HTTP/1.1" 200 156 "-" "curl/7.68.0"
 */
const prodFormat = 'combined';

/**
 * Stream configuration for Winston integration.
 * Routes Morgan output through Winston's HTTP log level for unified logging.
 */
const streamConfig = {
  stream: logger.stream,
};

/**
 * Skip function for Morgan to skip logging certain requests.
 * In production, skips logging for health check endpoints to reduce noise.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {boolean} True to skip logging, false to log
 */
const skipFn = (req, res) => {
  // In production, skip logging health check requests
  if (config.isProduction && req.url === '/health') {
    return true;
  }
  return false;
};

/**
 * Morgan request logging middleware configured for the current environment.
 *
 * In development:
 * - Uses 'dev' format with colored status codes
 * - Logs all requests including health checks
 *
 * In production:
 * - Uses 'combined' format (Apache standard)
 * - Skips health check requests to reduce log noise
 * - Streams through Winston for unified log management
 *
 * @type {Function}
 */
const requestLogger = morgan(
  config.isDevelopment ? devFormat : prodFormat,
  {
    stream: logger.stream,
    skip: skipFn,
  }
);

/**
 * Export the configured Morgan middleware.
 *
 * @exports requestLogger
 */
module.exports = { requestLogger };
