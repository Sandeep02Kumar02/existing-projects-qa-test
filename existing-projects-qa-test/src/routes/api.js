/**
 * @fileoverview API routes for the Express.js application.
 *
 * This module provides the API endpoints including echo and info endpoints.
 * These routes demonstrate request/response handling and server metadata
 * retrieval.
 *
 * Migrated from the original server.js endpoint handlers.
 *
 * @module routes/api
 * @requires express
 * @requires config
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * const apiRouter = require('./routes/api');
 * app.use('/api', apiRouter);
 */

'use strict';

const express = require('express');
const config = require('../config');

/**
 * Express router for API endpoints.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * POST /api/echo - Echo endpoint.
 *
 * Reflects the request body, headers, and metadata back to the client.
 * Useful for testing and debugging API requests.
 *
 * Request:
 * - Method: POST
 * - Body: Any JSON payload
 *
 * Response Format:
 * {
 *   "echo": {
 *     "body": { ... request body ... },
 *     "headers": { ... request headers ... },
 *     "method": "POST",
 *     "url": "/api/echo",
 *     "query": { ... query parameters ... },
 *     "timestamp": "2024-12-22T14:30:00.000Z"
 *   }
 * }
 *
 * @name POST /api/echo
 * @function
 * @memberof module:routes/api
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends JSON echo response
 *
 * @example
 * // curl -X POST http://localhost:3000/api/echo -H "Content-Type: application/json" -d '{"test": "data"}'
 * // Response: 200 OK with echoed request data
 */
router.post('/echo', (req, res) => {
  const echoResponse = {
    echo: {
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.originalUrl || req.url,
      query: req.query,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(echoResponse);
});

/**
 * GET /api/echo - Echo endpoint (GET version).
 *
 * GET version of echo that reflects query parameters and request metadata.
 *
 * @name GET /api/echo
 * @function
 * @memberof module:routes/api
 */
router.get('/echo', (req, res) => {
  const echoResponse = {
    echo: {
      query: req.query,
      headers: req.headers,
      method: req.method,
      url: req.originalUrl || req.url,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(echoResponse);
});

/**
 * GET /api/info - Server information endpoint.
 *
 * Returns metadata about the server and application configuration.
 * Sensitive information is filtered in production mode.
 *
 * Response Format:
 * {
 *   "info": {
 *     "name": "hello_world",
 *     "version": "1.0.0",
 *     "description": "Hello world in Node.js",
 *     "environment": "development",
 *     "nodeVersion": "v20.10.0",
 *     "platform": "linux",
 *     "uptime": 12345.67,
 *     "timestamp": "2024-12-22T14:30:00.000Z"
 *   }
 * }
 *
 * @name GET /api/info
 * @function
 * @memberof module:routes/api
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends JSON server info response
 *
 * @example
 * // curl http://localhost:3000/api/info
 * // Response: 200 OK with server metadata JSON
 */
router.get('/info', (req, res) => {
  // Load package.json for app metadata
  let packageInfo = { name: 'hello_world', version: '1.0.0', description: 'Hello world in Node.js' };
  try {
    packageInfo = require('../../package.json');
  } catch (e) {
    // Use defaults if package.json cannot be loaded
  }

  const infoResponse = {
    info: {
      name: packageInfo.name,
      version: packageInfo.version,
      description: packageInfo.description,
      environment: config.nodeEnv,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  };

  // Add additional details in development mode
  if (config.isDevelopment) {
    infoResponse.info.port = config.port;
    infoResponse.info.host = config.host;
    infoResponse.info.logLevel = config.logLevel;
  }

  res.status(200).json(infoResponse);
});

/**
 * Export the API router.
 *
 * @exports router
 */
module.exports = router;
