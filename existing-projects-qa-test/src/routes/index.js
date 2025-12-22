/**
 * @fileoverview Route aggregator for the Express.js application.
 *
 * This module serves as the central routing hub, mounting all route modules
 * at their respective paths. It provides the root endpoint and aggregates
 * health and API routes.
 *
 * Migrated from the original server.js routing logic with Express Router.
 *
 * @module routes
 * @requires express
 * @requires routes/health
 * @requires routes/api
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * const routes = require('./routes');
 * app.use('/', routes);
 */

'use strict';

const express = require('express');
const healthRouter = require('./health');
const apiRouter = require('./api');

/**
 * Express router for aggregating all application routes.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * GET / - Root endpoint.
 *
 * Returns the classic "Hello, World!" message.
 * Preserves the original behavior from server.js.
 *
 * @name GET /
 * @function
 * @memberof module:routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends plain text "Hello, World!" response
 *
 * @example
 * // curl http://localhost:3000/
 * // Response: "Hello, World!"
 */
router.get('/', (req, res) => {
  res.status(200).type('text/plain').send('Hello, World!\n');
});

/**
 * Mount health check routes at /health.
 *
 * Available endpoints:
 * - GET /health - Full health status with metrics
 * - GET /health/live - Kubernetes liveness probe
 * - GET /health/ready - Kubernetes readiness probe
 */
router.use('/health', healthRouter);

/**
 * Mount API routes at /api.
 *
 * Available endpoints:
 * - POST /api/echo - Echo request body and metadata
 * - GET /api/echo - Echo query parameters and metadata
 * - GET /api/info - Server information and metadata
 */
router.use('/api', apiRouter);

/**
 * Alternate root paths for compatibility.
 *
 * GET /echo - Direct access to echo endpoint (POST body or GET query)
 * GET /info - Direct access to server info endpoint
 *
 * These provide backward compatibility if users expect endpoints at root level.
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

router.get('/info', (req, res) => {
  const config = require('../config');
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

  if (config.isDevelopment) {
    infoResponse.info.port = config.port;
    infoResponse.info.host = config.host;
    infoResponse.info.logLevel = config.logLevel;
  }

  res.status(200).json(infoResponse);
});

/**
 * Export the aggregated routes.
 *
 * @exports router
 */
module.exports = router;
