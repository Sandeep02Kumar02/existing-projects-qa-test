/**
 * @fileoverview Express application factory module.
 *
 * This module creates and configures the Express application instance with
 * the complete middleware stack (helmet, cors, compression, body parser, morgan)
 * and mounts all route modules. Implements the factory pattern for testability
 * and separation of concerns.
 *
 * This module replaces the native HTTP server setup from the original server.js
 * with Express.js framework, providing improved routing, middleware support,
 * and better error handling capabilities.
 *
 * Middleware Order (per Agent Action Plan Section 0.7.1):
 * 1. helmet - Security headers
 * 2. cors - Cross-Origin Resource Sharing
 * 3. compression - Response compression
 * 4. express.json - JSON body parser
 * 5. express.urlencoded - URL-encoded body parser
 * 6. requestLogger - Morgan HTTP logging
 * 7. routes - Application routes
 * 8. notFound - 404 handler
 * 9. errorHandler - Centralized error handler
 *
 * @module app
 * @requires express
 * @requires helmet
 * @requires cors
 * @requires compression
 * @requires routes
 * @requires middleware/requestLogger
 * @requires middleware/notFound
 * @requires middleware/errorHandler
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Import and use with HTTP server
 * const app = require('./app');
 * const http = require('http');
 * const server = http.createServer(app);
 * server.listen(3000);
 *
 * @example
 * // Direct listen (for simple cases)
 * const app = require('./app');
 * app.listen(3000, () => console.log('Server running on port 3000'));
 *
 * @see Section 0.3.2 - Express application factory with middleware configuration
 * @see Section 0.5.6 - Factory Pattern: createApp() in src/app.js
 * @see Section 0.7.1 - Middleware order specification
 */

'use strict';

// =============================================================================
// EXTERNAL DEPENDENCIES
// =============================================================================

/**
 * Express.js web application framework.
 * Provides the core application factory, middleware system, and routing capabilities.
 * Replaces the native http.createServer() from original server.js.
 *
 * @external express
 * @see {@link https://expressjs.com/|Express.js Documentation}
 */
const express = require('express');

/**
 * Helmet security middleware.
 * Sets various HTTP headers to protect against well-known web vulnerabilities
 * including XSS attacks, clickjacking, MIME sniffing, and more.
 *
 * @external helmet
 * @see {@link https://helmetjs.github.io/|Helmet Documentation}
 */
const helmet = require('helmet');

/**
 * CORS (Cross-Origin Resource Sharing) middleware.
 * Enables configurable cross-origin requests for API consumption from
 * web browsers on different domains.
 *
 * @external cors
 * @see {@link https://github.com/expressjs/cors|CORS Documentation}
 */
const cors = require('cors');

/**
 * Compression middleware.
 * Provides gzip/deflate compression for response payloads to improve
 * transfer performance and reduce bandwidth usage.
 *
 * @external compression
 * @see {@link https://github.com/expressjs/compression|Compression Documentation}
 */
const compression = require('compression');

// =============================================================================
// INTERNAL DEPENDENCIES
// =============================================================================

/**
 * Express Router aggregator that mounts all route modules.
 * Provides centralized route management for the Express application.
 * Routes include: / (root), /health, /api (echo, info)
 *
 * @see module:routes/index
 */
const routes = require('./routes');

/**
 * Morgan HTTP request logging middleware integrated with Winston logger.
 * Provides structured access logging in both development and production
 * environments with environment-aware format selection.
 *
 * @see module:middleware/requestLogger
 */
const { requestLogger } = require('./middleware/requestLogger');

/**
 * Express 404 Not Found middleware.
 * Catches requests to undefined endpoints and returns structured JSON
 * error response. Must be registered after all routes.
 *
 * @see module:middleware/notFound
 */
const notFound = require('./middleware/notFound');

/**
 * Express centralized error handling middleware.
 * Implements the 4-argument pattern for structured JSON error responses
 * with environment-aware stack trace handling. Must be registered LAST.
 *
 * @see module:middleware/errorHandler
 */
const errorHandler = require('./middleware/errorHandler');

// =============================================================================
// EXPRESS APPLICATION INSTANCE
// =============================================================================

/**
 * Express application instance.
 *
 * This is the main application object that represents the Express application.
 * It has methods for routing HTTP requests, configuring middleware, rendering
 * HTML views, registering a template engine, and modifying application settings.
 *
 * The application is configured with the complete middleware stack and all
 * routes mounted, ready to be used with an HTTP server or for testing.
 *
 * @type {express.Application}
 * @constant
 */
const app = express();

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

/*
 * Middleware is configured in the exact order specified in Section 0.7.1:
 * Security → CORS → Compression → Body Parsing → Logging → Routes → Errors
 *
 * This order ensures:
 * 1. Security headers are set before any response is sent
 * 2. CORS is handled before request processing
 * 3. Compression is set up before any response body is written
 * 4. Request bodies are parsed before route handlers access them
 * 5. All requests are logged before reaching route handlers
 * 6. Errors are caught after all routes have been processed
 */

// -----------------------------------------------------------------------------
// 1. Security Middleware (First - applies to all responses)
// -----------------------------------------------------------------------------

/**
 * Helmet security middleware.
 *
 * Sets various HTTP security headers to protect against common web vulnerabilities:
 * - Content-Security-Policy: Prevents XSS and injection attacks
 * - X-DNS-Prefetch-Control: Controls browser DNS prefetching
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - Strict-Transport-Security: Enforces HTTPS connections
 * - X-XSS-Protection: Legacy XSS protection header
 *
 * Applied first to ensure all responses have security headers regardless of
 * the route or middleware that handles the request.
 *
 * @see {@link https://helmetjs.github.io/docs/|Helmet Security Headers}
 */
app.use(helmet());

// -----------------------------------------------------------------------------
// 2. CORS Middleware (Second - handles cross-origin requests)
// -----------------------------------------------------------------------------

/**
 * CORS middleware for cross-origin resource sharing.
 *
 * Enables Cross-Origin Resource Sharing for API consumption from web browsers
 * on different domains. Default configuration allows all origins in development.
 *
 * For production environments, configure with specific allowed origins:
 * @example
 * app.use(cors({
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization'],
 *   credentials: true
 * }));
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS|CORS MDN}
 */
app.use(cors());

// -----------------------------------------------------------------------------
// 3. Compression Middleware (Third - optimizes response size)
// -----------------------------------------------------------------------------

/**
 * Response compression middleware.
 *
 * Enables gzip/deflate compression for response payloads to improve transfer
 * performance over network connections. Automatically compresses responses
 * based on the Accept-Encoding header from the client.
 *
 * Benefits:
 * - Reduces bandwidth usage by 60-80% for text-based responses
 * - Improves page load times and API response times
 * - Particularly effective for JSON API responses
 *
 * Note: Compression is CPU-intensive; for high-traffic production environments,
 * consider offloading compression to a reverse proxy (Nginx, CloudFlare).
 *
 * @see {@link https://github.com/expressjs/compression#readme|Compression Options}
 */
app.use(compression());

// -----------------------------------------------------------------------------
// 4. Body Parsing Middleware (Fourth - parses request bodies)
// -----------------------------------------------------------------------------

/**
 * JSON body parser middleware.
 *
 * Parses incoming request bodies with JSON payloads (Content-Type: application/json).
 * The parsed body is available on req.body for route handlers.
 *
 * Configuration:
 * - limit: '10kb' - Maximum request body size to prevent payload attacks
 *   Requests exceeding this limit receive a 413 Payload Too Large error.
 *
 * Security: The size limit prevents denial-of-service attacks that attempt
 * to exhaust server memory with extremely large JSON payloads.
 *
 * @see {@link https://expressjs.com/en/api.html#express.json|express.json()}
 */
app.use(express.json({ limit: '10kb' }));

/**
 * URL-encoded body parser middleware.
 *
 * Parses incoming request bodies with URL-encoded payloads
 * (Content-Type: application/x-www-form-urlencoded).
 * The parsed body is available on req.body for route handlers.
 *
 * Configuration:
 * - extended: true - Allows for rich objects and arrays to be encoded
 *   using the qs library instead of querystring
 * - limit: '10kb' - Maximum request body size to prevent payload attacks
 *
 * @see {@link https://expressjs.com/en/api.html#express.urlencoded|express.urlencoded()}
 */
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// -----------------------------------------------------------------------------
// 5. Logging Middleware (Fifth - logs all requests)
// -----------------------------------------------------------------------------

/**
 * HTTP request logging middleware.
 *
 * Uses Morgan for structured HTTP request logging integrated with Winston logger.
 * Provides access logs for monitoring, debugging, and security analysis.
 *
 * Environment-aware formatting:
 * - Development: 'dev' format with colored, concise output
 * - Production: 'combined' format (Apache combined log format)
 *
 * All logs are routed through Winston's 'http' transport for unified
 * logging to both console and file outputs.
 *
 * @see module:middleware/requestLogger
 */
app.use(requestLogger);

// -----------------------------------------------------------------------------
// 6. Application Routes (Sixth - handles API endpoints)
// -----------------------------------------------------------------------------

/**
 * Mount all application routes.
 *
 * Routes are aggregated in src/routes/index.js and provide:
 * - GET /         - Returns "Hello, World!" (text/plain)
 * - GET /health   - Health check with status, uptime, and memory metrics
 * - POST /echo    - Echoes the request body back to the client
 * - GET /info     - Returns server metadata and environment information
 *
 * All routes preserve the exact response formats from the original server.js
 * implementation to maintain backward compatibility.
 *
 * @see module:routes/index
 * @see Section 0.5.5 - User-Provided Examples Integration
 */
app.use('/', routes);

// -----------------------------------------------------------------------------
// 7. Error Handling Middleware (LAST - catches all errors)
// -----------------------------------------------------------------------------

/**
 * 404 Not Found handler.
 *
 * Catches requests to undefined endpoints and returns a structured JSON
 * error response. This middleware acts as a catch-all for routes that
 * don't match any defined route handlers.
 *
 * Response format:
 * {
 *   "status": "fail",
 *   "error": "NotFound",
 *   "message": "Cannot GET /unknown-path",
 *   "path": "/unknown-path"
 * }
 *
 * Must be registered after all routes but before the error handler.
 *
 * @see module:middleware/notFound
 */
app.use(notFound);

/**
 * Centralized error handler.
 *
 * Catches all errors thrown or passed via next(error) in the middleware chain
 * and returns a structured JSON error response. Implements the Express
 * 4-argument error middleware pattern.
 *
 * Features:
 * - Structured JSON error responses with consistent format
 * - Environment-aware error detail (full in dev, sanitized in prod)
 * - Stack trace inclusion controlled by NODE_ENV
 * - Comprehensive error logging via Winston
 *
 * Response format:
 * {
 *   "status": "error",
 *   "error": "InternalServerError",
 *   "message": "Something went wrong",
 *   "stack": "..." (development only),
 *   "path": "/api/endpoint"
 * }
 *
 * MUST be registered as the LAST middleware to catch all errors.
 *
 * @see module:middleware/errorHandler
 */
app.use(errorHandler);

// =============================================================================
// APPLICATION SETTINGS
// =============================================================================

/**
 * Disable X-Powered-By header.
 *
 * Prevents Express from advertising itself in response headers.
 * This is a security best practice to reduce information disclosure
 * about the server technology stack.
 *
 * Note: Helmet also handles this, but this explicit setting ensures
 * the header is disabled even if Helmet configuration changes.
 */
app.disable('x-powered-by');

// =============================================================================
// MODULE EXPORT
// =============================================================================

/**
 * Export the configured Express application instance.
 *
 * The exported application is fully configured with:
 * - Security middleware (helmet)
 * - CORS support
 * - Response compression
 * - Request body parsing (JSON, URL-encoded)
 * - HTTP request logging (Morgan + Winston)
 * - All application routes
 * - 404 handler
 * - Centralized error handler
 *
 * Usage in src/server.js:
 * @example
 * const app = require('./app');
 * const http = require('http');
 * const server = http.createServer(app);
 * server.listen(port, host, callback);
 *
 * Usage for testing:
 * @example
 * const request = require('supertest');
 * const app = require('./app');
 * request(app).get('/health').expect(200);
 *
 * @exports app
 * @type {express.Application}
 */
module.exports = app;
