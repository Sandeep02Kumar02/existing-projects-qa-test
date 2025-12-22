/**
 * @fileoverview Health check route for the Express.js application.
 *
 * This module provides health check endpoints for monitoring and orchestration
 * systems (Kubernetes, load balancers, etc.). Returns server status, uptime,
 * memory usage, and other runtime metrics.
 *
 * @module routes/health
 * @requires express
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * const healthRouter = require('./routes/health');
 * app.use('/health', healthRouter);
 *
 * @see {@link https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/|Kubernetes Health Probes}
 */

'use strict';

const express = require('express');

/**
 * Express router for health check endpoints.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * GET /health - Health check endpoint.
 *
 * Returns server health status with runtime metrics including:
 * - status: Server health status ("healthy")
 * - timestamp: Current ISO timestamp
 * - uptime: Process uptime in seconds
 * - memory: Memory usage statistics (heap, RSS, external)
 * - environment: Current NODE_ENV value
 * - version: Node.js version
 *
 * Response Format:
 * {
 *   "status": "healthy",
 *   "timestamp": "2024-12-22T14:30:00.000Z",
 *   "uptime": 12345.67,
 *   "memory": {
 *     "heapUsed": 12345678,
 *     "heapTotal": 23456789,
 *     "rss": 34567890,
 *     "external": 1234567
 *   },
 *   "environment": "development",
 *   "nodeVersion": "v20.10.0"
 * }
 *
 * @name GET /health
 * @function
 * @memberof module:routes/health
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends JSON health status response
 *
 * @example
 * // curl http://localhost:3000/health
 * // Response: 200 OK with health metrics JSON
 */
router.get('/', (req, res) => {
  const memoryUsage = process.memoryUsage();

  const healthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
    },
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  };

  res.status(200).json(healthResponse);
});

/**
 * GET /health/live - Kubernetes liveness probe endpoint.
 *
 * Simple endpoint that returns 200 if the process is running.
 * Used by Kubernetes to determine if the container should be restarted.
 *
 * @name GET /health/live
 * @function
 * @memberof module:routes/health
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * GET /health/ready - Kubernetes readiness probe endpoint.
 *
 * Endpoint that returns 200 if the server is ready to accept traffic.
 * Can be extended to check database connections, cache availability, etc.
 *
 * @name GET /health/ready
 * @function
 * @memberof module:routes/health
 */
router.get('/ready', (req, res) => {
  // Can be extended to check database connections, cache, etc.
  res.status(200).json({ status: 'ready' });
});

/**
 * Export the health router.
 *
 * @exports router
 */
module.exports = router;
