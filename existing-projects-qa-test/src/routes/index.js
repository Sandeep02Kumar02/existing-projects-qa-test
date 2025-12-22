/**
 * @fileoverview Express route aggregator module.
 *
 * This module serves as the central routing hub for the Express.js application,
 * mounting all route modules to their respective paths and implementing the root
 * endpoint. It aggregates health check and API routes under their designated paths
 * while providing the classic "Hello, World!" response at the root endpoint.
 *
 * This module replaces the manual routing logic from the original server.js
 * (lines 76-104) with the Express Router pattern, maintaining backward compatibility
 * with the original API response formats as specified in Section 0.1.3.
 *
 * Route Structure:
 * - GET /           → Returns "Hello, World!" (text/plain)
 * - /health/*       → Health check routes (status, uptime, memory)
 * - /api/*          → API routes (echo, info endpoints)
 *
 * @module routes/index
 * @requires express
 * @requires ./health
 * @requires ./api
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Usage in src/app.js
 * const express = require('express');
 * const routes = require('./routes');
 *
 * const app = express();
 * app.use('/', routes);
 *
 * @see Section 0.3.2 - Route aggregator mounting all route modules
 * @see Section 0.3.5 - App → Routes: src/app.js imports from src/routes/index.js
 * @see Section 0.5.5 - User-Provided Examples Integration
 * @see Section 0.7.4 - API Response Validation
 */

'use strict';

// =============================================================================
// External Dependencies
// =============================================================================

const express = require('express');

// =============================================================================
// Internal Dependencies
// =============================================================================

/**
 * Health check routes module.
 * Provides health status endpoint with metrics (status, timestamp, uptime, memory).
 * Mounted at /health path.
 * @type {express.Router}
 */
const healthRoutes = require('./health');

/**
 * API routes module.
 * Provides utility endpoints including echo (request reflection) and info (server metadata).
 * Mounted at /api path.
 * @type {express.Router}
 */
const apiRoutes = require('./api');

// =============================================================================
// Router Instance
// =============================================================================

/**
 * Express Router instance for aggregating all application routes.
 *
 * This router serves as the central routing hub, mounting all route modules
 * and implementing the root endpoint. It is exported as the default module
 * export for use by src/app.js.
 *
 * @type {express.Router}
 * @constant
 */
const router = express.Router();

// =============================================================================
// Root Endpoint
// =============================================================================

/**
 * GET / - Root endpoint handler.
 *
 * Returns the classic "Hello, World!" message with text/plain content type.
 * This endpoint preserves the exact response format from the original server.js
 * implementation (lines 87-90) to maintain backward compatibility.
 *
 * Original implementation:
 * ```javascript
 * res.statusCode = 200;
 * res.setHeader('Content-Type', 'text/plain');
 * res.end('Hello, World!\n');
 * ```
 *
 * Express equivalent:
 * ```javascript
 * res.status(200).type('text/plain').send('Hello, World!\n');
 * ```
 *
 * @name GET /
 * @function
 * @memberof module:routes/index
 *
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} Sends plain text "Hello, World!\n" response (HTTP 200)
 *
 * @example
 * // Request
 * curl http://localhost:3000/
 *
 * // Response (200 OK)
 * // Content-Type: text/plain
 * Hello, World!
 *
 * @see Section 0.5.5 - GET / returns "Hello, World!"
 * @see Section 0.7.4 - GET / returns "Hello, World!" (200)
 */
router.get('/', (req, res) => {
  // Set status code to 200 (OK)
  // Set Content-Type to text/plain to match original server.js behavior
  // Send the exact same response body as the original implementation
  res.status(200).type('text/plain').send('Hello, World!\n');
});

// =============================================================================
// Route Module Mounting
// =============================================================================

/**
 * Mount health check routes at /health path.
 *
 * The health routes module provides endpoints for application health monitoring:
 * - GET /health → Full health status with metrics (status, timestamp, uptime, memory)
 *
 * These endpoints are designed for use by:
 * - Load balancers for health probes
 * - Kubernetes liveness/readiness probes
 * - Monitoring systems for metrics collection
 * - Application dashboards for status display
 *
 * @see module:routes/health
 * @see Section 0.3.2 - router.use('/health', healthRoutes)
 */
router.use('/health', healthRoutes);

/**
 * Mount API routes at /api path.
 *
 * The API routes module provides utility endpoints for the application:
 * - POST /api/echo → Echoes the request body back to the client
 * - GET /api/info  → Returns server metadata and configuration
 *
 * These endpoints are useful for:
 * - Testing and debugging API integrations
 * - Verifying server configuration
 * - Monitoring server status and version information
 *
 * @see module:routes/api
 * @see Section 0.3.2 - router.use('/api', apiRoutes)
 */
router.use('/api', apiRoutes);

// =============================================================================
// Module Export
// =============================================================================

/**
 * Export the aggregated router.
 *
 * This router should be mounted at the root path in src/app.js:
 * ```javascript
 * const routes = require('./routes');
 * app.use('/', routes);
 * ```
 *
 * The resulting route hierarchy:
 * - GET /           → "Hello, World!" response
 * - GET /health     → Health status with metrics
 * - POST /api/echo  → Request body echo
 * - GET /api/info   → Server metadata
 *
 * @exports router
 * @type {express.Router}
 */
module.exports = router;
