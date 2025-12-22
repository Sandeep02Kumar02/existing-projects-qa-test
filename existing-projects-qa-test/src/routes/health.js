/**
 * @fileoverview Express router module for health check endpoint.
 *
 * This module provides a health check endpoint for monitoring application health status
 * with comprehensive metrics including status indicator, timestamp, uptime duration,
 * and memory usage statistics. Designed for use by monitoring systems, load balancers,
 * and orchestration platforms for health probes.
 *
 * @module routes/health
 * @requires express
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Mount the health router in your Express application
 * const healthRouter = require('./routes/health');
 * app.use('/health', healthRouter);
 *
 * @example
 * // Health check request
 * // curl http://localhost:3000/health
 * // Response:
 * // {
 * //   "status": "ok",
 * //   "timestamp": "2024-12-22T14:30:00.000Z",
 * //   "uptime": 12345.67,
 * //   "memory": {
 * //     "rss": 34567890,
 * //     "heapTotal": 23456789,
 * //     "heapUsed": 12345678,
 * //     "external": 1234567,
 * //     "arrayBuffers": 123456
 * //   }
 * // }
 *
 * @see {@link https://expressjs.com/en/guide/routing.html|Express Routing Documentation}
 * @see {@link https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/|Kubernetes Health Probes}
 */

'use strict';

const express = require('express');

/**
 * Express router instance for health check routes.
 *
 * This router handles health check endpoints that return JSON responses
 * containing server health status and runtime metrics.
 *
 * @type {express.Router}
 * @constant
 */
const router = express.Router();

/**
 * GET / - Health check endpoint (mounted at /health).
 *
 * Returns comprehensive application health status including runtime metrics
 * for monitoring and load balancer health probes. The response provides
 * real-time information about the application's operational state.
 *
 * Response Structure (per Section 0.7.4):
 * - status: Health status indicator ("ok" indicates healthy)
 * - timestamp: Current server time in ISO 8601 format
 * - uptime: Process uptime in seconds since server start
 * - memory: Full memory usage statistics from process.memoryUsage()
 *
 * @name GET /
 * @function
 * @memberof module:routes/health
 *
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} Sends JSON response with health status (HTTP 200)
 *
 * @example
 * // Example response:
 * // HTTP 200 OK
 * // Content-Type: application/json
 * // {
 * //   "status": "ok",
 * //   "timestamp": "2024-12-22T10:30:45.123Z",
 * //   "uptime": 3600.25,
 * //   "memory": {
 * //     "rss": 52428800,
 * //     "heapTotal": 18014208,
 * //     "heapUsed": 9546240,
 * //     "external": 1089863,
 * //     "arrayBuffers": 26422
 * //   }
 * // }
 *
 * @description
 * Use Cases:
 * - Load balancer health checks to verify server availability
 * - Kubernetes liveness/readiness probes for container orchestration
 * - Monitoring systems to collect server metrics
 * - Application dashboards for real-time status display
 * - Automated alerting systems to detect server issues
 *
 * Response Fields:
 * - status: String indicating server health ("ok" = healthy and operational)
 * - timestamp: ISO 8601 formatted datetime of when the check was performed
 * - uptime: Number of seconds the Node.js process has been running
 * - memory: Object containing memory metrics from process.memoryUsage():
 *   - rss: Resident Set Size - total memory allocated for the process
 *   - heapTotal: Total size of the allocated V8 heap
 *   - heapUsed: Actual memory used by V8 heap
 *   - external: Memory used by C++ objects bound to JavaScript objects
 *   - arrayBuffers: Memory allocated for ArrayBuffers and SharedArrayBuffers
 */
router.get('/', (req, res) => {
  // Build health status response with real-time metrics
  // Structure follows Section 0.7.4 API Response Validation specification
  const healthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  // Send JSON response with 200 status code
  // Content-Type is automatically set to application/json by res.json()
  res.status(200).json(healthResponse);
});

/**
 * Export the health check router.
 *
 * The router should be mounted at the /health path in the main application:
 * app.use('/health', healthRouter);
 *
 * @exports router
 * @type {express.Router}
 */
module.exports = router;
