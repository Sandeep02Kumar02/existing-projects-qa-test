/**
 * @fileoverview Express router module for API endpoints.
 *
 * This module implements API routes for the Express.js application including:
 * - POST /echo: Request body reflection endpoint
 * - GET /info: Server metadata endpoint
 *
 * These endpoints extend the original server.js functionality as part of the
 * Express.js migration, providing structured request handling through Express
 * Router pattern per Section 0.3.2 of the Agent Action Plan.
 *
 * @module routes/api
 * @requires express
 * @requires ../config
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Mount in the main application (src/routes/index.js)
 * const apiRouter = require('./api');
 * app.use('/api', apiRouter);
 *
 * // Or mount directly in app.js
 * app.use('/api', require('./routes/api'));
 *
 * @see Section 0.3.2 - API routes for echo, info endpoints
 * @see Section 0.5.5 - User-Provided Examples Integration
 * @see Section 0.7.4 - API Response Validation
 */

'use strict';

const express = require('express');
const config = require('../config');

/**
 * Express Router instance for API endpoints.
 *
 * This router handles API-specific routes that provide utility functions
 * for request inspection (echo) and server information retrieval (info).
 *
 * @type {express.Router}
 * @constant
 */
const router = express.Router();

/**
 * POST /echo - Request body reflection endpoint.
 *
 * Reflects the incoming request body back to the client. This endpoint is
 * useful for testing request/response cycles, debugging API integrations,
 * and verifying that request body parsing is functioning correctly.
 *
 * The endpoint expects a JSON body (parsed by express.json() middleware
 * configured in src/app.js) and returns it wrapped in an "echo" property.
 *
 * @name POST /echo
 * @function
 * @memberof module:routes/api
 *
 * @param {express.Request} req - Express request object
 * @param {Object} req.body - Parsed JSON request body (from express.json())
 * @param {express.Response} res - Express response object
 * @returns {void} Sends JSON response with echoed body
 *
 * @example
 * // Request
 * curl -X POST http://localhost:3000/api/echo \
 *   -H "Content-Type: application/json" \
 *   -d '{"message": "Hello", "count": 42}'
 *
 * // Response (200 OK)
 * {
 *   "echo": {
 *     "message": "Hello",
 *     "count": 42
 *   }
 * }
 *
 * @example
 * // Empty body request
 * curl -X POST http://localhost:3000/api/echo \
 *   -H "Content-Type: application/json" \
 *   -d '{}'
 *
 * // Response (200 OK)
 * {
 *   "echo": {}
 * }
 *
 * @description
 * Response Codes:
 * - 200: Success - returns echoed request body
 * - 400: Bad Request - invalid JSON body (handled by express.json())
 *
 * @since 1.0.0
 * @see Section 0.5.5 - POST /echo reflects request body
 * @see Section 0.7.4 - POST /echo returns echo of request body (200)
 */
router.post('/echo', (req, res) => {
  // Return the request body wrapped in "echo" property
  // Per Section 0.3.2: Response body: { "echo": req.body }
  const echoResponse = {
    echo: req.body,
  };

  res.status(200).json(echoResponse);
});

/**
 * GET /info - Server metadata endpoint.
 *
 * Returns metadata about the running server including application name,
 * version, description, Node.js runtime version, current environment mode,
 * and server uptime in seconds.
 *
 * This endpoint is useful for monitoring, debugging, and health verification
 * of deployed instances. It provides essential information about the server's
 * configuration and runtime state.
 *
 * @name GET /info
 * @function
 * @memberof module:routes/api
 *
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} Sends JSON response with server metadata
 *
 * @example
 * // Request
 * curl http://localhost:3000/api/info
 *
 * // Response (200 OK)
 * {
 *   "name": "hello_world",
 *   "version": "1.0.0",
 *   "description": "Express.js HTTP Server",
 *   "nodeVersion": "v20.10.0",
 *   "environment": "development",
 *   "uptime": 12345.678
 * }
 *
 * @description
 * Response Fields:
 * - name: Application name (always "hello_world")
 * - version: Application version (always "1.0.0")
 * - description: Application description
 * - nodeVersion: Node.js runtime version (e.g., "v20.10.0")
 * - environment: Current NODE_ENV value from config
 * - uptime: Server uptime in seconds (floating-point)
 *
 * Response Codes:
 * - 200: Success - returns server metadata JSON
 *
 * @since 1.0.0
 * @see Section 0.3.2 - GET /info returns server metadata
 * @see Section 0.5.5 - GET /info returns server metadata
 * @see Section 0.7.4 - GET /info returns server metadata JSON (200)
 */
router.get('/info', (req, res) => {
  // Build server metadata response
  // Per Section 0.3.2, the response structure is:
  // {
  //   "name": "hello_world",
  //   "version": "1.0.0",
  //   "description": "Express.js HTTP Server",
  //   "nodeVersion": process.version,
  //   "environment": config.nodeEnv,
  //   "uptime": process.uptime()
  // }
  const infoResponse = {
    name: 'hello_world',
    version: '1.0.0',
    description: 'Express.js HTTP Server',
    nodeVersion: process.version,
    environment: config.nodeEnv,
    uptime: process.uptime(),
  };

  res.status(200).json(infoResponse);
});

/**
 * Export the API router for use in the main application.
 *
 * The router should be mounted at the '/api' path prefix in the main
 * routes aggregator (src/routes/index.js) or directly in app.js.
 *
 * @example
 * // In src/routes/index.js
 * const apiRouter = require('./api');
 * router.use('/api', apiRouter);
 *
 * // Resulting endpoints:
 * // POST /api/echo
 * // GET /api/info
 *
 * @exports router
 * @type {express.Router}
 */
module.exports = router;
