/**
 * @fileoverview Morgan HTTP request logging middleware integrated with Winston logger stream.
 *
 * This module configures Morgan HTTP request logging middleware to output access logs
 * through Winston's 'http' log level, providing unified logging across the application.
 * It implements environment-aware format selection:
 *
 * - Development: Uses Morgan's 'dev' format for colored, concise output ideal for
 *   debugging and local development. Format: :method :url :status :response-time ms
 *
 * - Production: Uses Morgan's 'combined' format (Apache combined log format) for
 *   comprehensive access logs suitable for log aggregation and analysis.
 *   Format: :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version"
 *           :status :res[content-length] ":referrer" ":user-agent"
 *
 * The middleware streams all output through the Winston logger's stream adapter,
 * which writes to the 'http' log level. This ensures consistent formatting and
 * transport to both console and file destinations as configured in utils/logger.js.
 *
 * @module middleware/requestLogger
 * @requires morgan
 * @requires ../config
 * @requires ../utils/logger
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Import in Express application (app.js)
 * const { requestLogger } = require('./middleware/requestLogger');
 *
 * // Apply as middleware - must come after body parsing but before routes
 * app.use(requestLogger);
 *
 * // Example development output:
 * // GET /health 200 2.345 ms - 156
 *
 * // Example production output:
 * // ::1 - - [22/Dec/2024:14:30:00 +0000] "GET /health HTTP/1.1" 200 156 "-" "curl/7.68.0"
 *
 * @see {@link https://github.com/expressjs/morgan|Morgan Documentation}
 * @see {@link https://github.com/winstonjs/winston|Winston Documentation}
 */

'use strict';

// =============================================================================
// IMPORTS
// =============================================================================

/**
 * Morgan HTTP request logging middleware.
 * Provides predefined formats ('dev', 'combined', 'common', 'short', 'tiny')
 * and supports custom formats and output streams.
 *
 * @external morgan
 * @see {@link https://github.com/expressjs/morgan|Morgan GitHub}
 */
const morgan = require('morgan');

/**
 * Application configuration module.
 * Provides isDevelopment flag for environment-based format selection.
 *
 * @see module:config
 */
const config = require('../config');

/**
 * Winston logger instance with stream property for Morgan integration.
 * The stream.write function routes Morgan output to Winston's 'http' log level.
 *
 * @see module:utils/logger
 */
const logger = require('../utils/logger');

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Morgan format for development environment.
 * The 'dev' format provides concise, colored output optimized for development:
 * - Colored status codes (green for success, red for errors, yellow for redirects)
 * - Shows method, URL, status, and response time
 * - Ideal for local development and debugging
 *
 * Output format: :method :url :status :response-time ms - :res[content-length]
 *
 * @const {string}
 * @example
 * // Sample output with 'dev' format:
 * // GET /api/users 200 4.521 ms - 1234
 * // POST /api/login 401 1.234 ms - 56
 */
const DEVELOPMENT_FORMAT = 'dev';

/**
 * Morgan format for production environment.
 * The 'combined' format follows Apache combined log format standard,
 * providing comprehensive request information suitable for:
 * - Log aggregation systems (ELK, Splunk, CloudWatch)
 * - Security analysis and auditing
 * - Traffic analysis and monitoring
 *
 * Output format: :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version"
 *               :status :res[content-length] ":referrer" ":user-agent"
 *
 * @const {string}
 * @example
 * // Sample output with 'combined' format:
 * // 192.168.1.1 - - [22/Dec/2024:14:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0..."
 */
const PRODUCTION_FORMAT = 'combined';

// =============================================================================
// SKIP CONFIGURATION
// =============================================================================

/**
 * Determines whether to skip logging for a given request.
 *
 * This function can be customized to reduce log noise by skipping certain
 * requests. Currently configured to optionally skip health check endpoints
 * in production to prevent log flooding from container orchestrators,
 * load balancers, and monitoring systems that frequently poll health endpoints.
 *
 * @param {Object} req - Express request object
 * @param {string} req.url - The request URL path
 * @param {Object} res - Express response object
 * @param {number} res.statusCode - The HTTP response status code
 * @returns {boolean} True to skip logging this request, false to log it
 *
 * @example
 * // Current behavior:
 * // - Development: All requests are logged (returns false)
 * // - Production: Health check requests may be skipped (configurable)
 *
 * @private
 */
const shouldSkipLogging = (req, res) => {
  // Option 1: Skip health checks in production to reduce noise
  // Uncomment the following block if health check logging is too verbose:
  //
  // if (config.isProduction && req.url === '/health') {
  //   return true;
  // }

  // Option 2: Skip successful health checks but log failures
  // This ensures health issues are still captured while reducing routine logs:
  //
  // if (req.url === '/health' && res.statusCode < 400) {
  //   return true;
  // }

  // Default: Log all requests for complete visibility
  // This is the recommended setting for most applications to ensure
  // comprehensive request tracking and debugging capability
  return false;
};

// =============================================================================
// STREAM CONFIGURATION
// =============================================================================

/**
 * Morgan options configuration object.
 *
 * Configures Morgan to stream output through the Winston logger instance,
 * which provides unified logging with consistent formatting across all
 * application log sources.
 *
 * The stream property connects to logger.stream defined in utils/logger.js:
 * {
 *   write: (message) => logger.http(message.trim())
 * }
 *
 * This writes all Morgan HTTP request logs at Winston's 'http' log level,
 * ensuring they appear in both console and file transports with proper
 * timestamps and formatting.
 *
 * @const {Object}
 * @property {Object} stream - Winston stream adapter for log output
 * @property {Function} skip - Function to determine if request should be skipped
 */
const morganOptions = {
  /**
   * Stream object for directing Morgan output to Winston.
   * The logger.stream adapter writes to Winston's 'http' log level,
   * ensuring unified logging across all transports (console, file).
   *
   * @type {Object}
   */
  stream: logger.stream,

  /**
   * Skip function to conditionally skip logging certain requests.
   * Can be configured to reduce log noise for health checks or
   * other high-frequency endpoints.
   *
   * @type {Function}
   */
  skip: shouldSkipLogging,
};

// =============================================================================
// FORMAT SELECTION
// =============================================================================

/**
 * Selects the appropriate Morgan log format based on the current environment.
 *
 * Environment-based format selection ensures optimal logging for each context:
 * - Development: 'dev' format with colored, human-readable output
 * - Production: 'combined' format with comprehensive Apache-style logs
 *
 * @const {string}
 */
const selectedFormat = config.isDevelopment ? DEVELOPMENT_FORMAT : PRODUCTION_FORMAT;

// =============================================================================
// MIDDLEWARE CREATION
// =============================================================================

/**
 * Morgan HTTP request logging middleware configured for the Express.js application.
 *
 * This middleware logs all incoming HTTP requests with environment-appropriate
 * formatting and routes output through the Winston logger for unified log management.
 *
 * Features:
 * - Environment-aware format selection ('dev' for development, 'combined' for production)
 * - Unified logging through Winston's stream adapter
 * - Configurable request skipping for noise reduction
 * - Compatible with all Express.js route handlers
 *
 * Usage in app.js:
 * ```javascript
 * const { requestLogger } = require('./middleware/requestLogger');
 * app.use(requestLogger);
 * ```
 *
 * Middleware Order:
 * This middleware should be placed after body parsing middleware but before
 * route handlers to ensure all requests are logged:
 *
 * 1. helmet() - Security headers
 * 2. cors() - CORS handling
 * 3. compression() - Response compression
 * 4. express.json() - Body parsing
 * 5. requestLogger - HTTP request logging ← THIS MIDDLEWARE
 * 6. routes - Route handlers
 * 7. errorHandler - Error handling
 *
 * @type {Function}
 * @function requestLogger
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * // Development output (colored in terminal):
 * // [2024-12-22 14:30:00] http: GET /api/users 200 4.521 ms - 1234
 *
 * @example
 * // Production output (JSON in log files):
 * // {"level":"http","message":"::1 - - [22/Dec/2024:14:30:00 +0000] \"GET /api/users HTTP/1.1\" 200 1234 \"-\" \"curl/7.68.0\"","timestamp":"2024-12-22 14:30:00"}
 */
const requestLogger = morgan(selectedFormat, morganOptions);

// =============================================================================
// MODULE EXPORTS
// =============================================================================

/**
 * Export the configured Morgan middleware as a named export.
 *
 * Named export pattern is used to allow for future expansion of the module
 * with additional middleware or utility functions if needed.
 *
 * Import example:
 * ```javascript
 * const { requestLogger } = require('./middleware/requestLogger');
 * ```
 *
 * @exports requestLogger
 * @type {Function}
 */
module.exports = { requestLogger };
