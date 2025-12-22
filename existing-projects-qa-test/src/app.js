/**
 * @fileoverview Express application factory module.
 *
 * This module creates and configures the Express application instance with
 * the complete middleware stack (helmet, cors, compression, body parser, morgan)
 * and mounts all route modules. Implements the factory pattern for testability
 * and separation of concerns.
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
 * const app = require('./app');
 * const http = require('http');
 * const server = http.createServer(app);
 * server.listen(3000);
 */

'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const routes = require('./routes');
const { requestLogger } = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/**
 * Express application instance.
 * @type {express.Application}
 */
const app = express();

// =============================================================================
// Security Middleware
// =============================================================================

/**
 * Helmet security middleware.
 * Sets various HTTP headers to protect against well-known web vulnerabilities:
 * - Content-Security-Policy
 * - X-DNS-Prefetch-Control
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection (legacy)
 */
app.use(helmet());

/**
 * CORS middleware.
 * Enables Cross-Origin Resource Sharing for API consumption from web browsers.
 * In production, configure with specific allowed origins.
 */
app.use(cors());

// =============================================================================
// Performance Middleware
// =============================================================================

/**
 * Compression middleware.
 * Enables gzip/deflate compression for response payloads to improve
 * transfer performance over network connections.
 */
app.use(compression());

// =============================================================================
// Body Parsing Middleware
// =============================================================================

/**
 * JSON body parser.
 * Parses incoming request bodies with JSON payloads.
 * Limit set to 10kb to prevent payload attacks.
 */
app.use(express.json({ limit: '10kb' }));

/**
 * URL-encoded body parser.
 * Parses incoming request bodies with URL-encoded payloads.
 * Extended: true allows for rich objects and arrays to be encoded.
 */
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// =============================================================================
// Logging Middleware
// =============================================================================

/**
 * Request logging middleware.
 * Uses Morgan for HTTP request logging integrated with Winston.
 * Provides structured access logs for monitoring and debugging.
 */
app.use(requestLogger);

// =============================================================================
// Application Routes
// =============================================================================

/**
 * Mount all application routes.
 * Routes are aggregated in src/routes/index.js and include:
 * - GET / - Hello World
 * - GET /health - Health check with metrics
 * - POST /echo - Request echo
 * - GET /info - Server information
 */
app.use('/', routes);

// =============================================================================
// Error Handling Middleware (must be LAST)
// =============================================================================

/**
 * 404 Not Found handler.
 * Catches requests to undefined endpoints and returns structured JSON response.
 * Must be registered after all routes.
 */
app.use(notFound);

/**
 * Centralized error handler.
 * Catches all errors and returns structured JSON response.
 * Must be registered as the LAST middleware.
 */
app.use(errorHandler);

/**
 * Disable X-Powered-By header.
 * Prevents Express from advertising itself in response headers.
 */
app.disable('x-powered-by');

/**
 * Export the configured Express application.
 *
 * @exports app
 */
module.exports = app;
