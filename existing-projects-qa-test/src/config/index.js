/**
 * @fileoverview Centralized environment configuration module for the Express.js application.
 *
 * This module loads environment variables from .env files using dotenv and exports
 * a validated configuration object following 12-factor app principles. All environment
 * variable access is consolidated here to provide a single source of truth for
 * application configuration.
 *
 * CRITICAL: dotenv.config() must be called before any other module attempts to read
 * process.env values. In the Express.js application architecture, this module is
 * imported early in the bootstrap process (src/server.js).
 *
 * @module config
 * @requires dotenv
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Import configuration in other modules
 * const config = require('./config');
 *
 * // Access server settings
 * app.listen(config.port, config.host);
 *
 * // Check environment
 * if (config.isDevelopment) {
 *   // Enable development-only features
 * }
 *
 * @see {@link https://12factor.net/config|12-Factor App Configuration}
 */

'use strict';

// CRITICAL: Load environment variables from .env file FIRST
// This must happen before accessing any process.env values to ensure
// environment variables from .env file are properly populated.
// The dotenv package reads the .env file from the project root directory
// and adds the variables to process.env, making them available throughout
// the application.
require('dotenv').config();

/**
 * Parses and validates the PORT environment variable.
 *
 * @param {string|undefined} portValue - The raw PORT environment variable value
 * @param {number} defaultPort - The default port to use if parsing fails
 * @returns {number} A valid port number
 * @throws {Error} If the port number is outside the valid range (1-65535)
 *
 * @private
 */
function parsePort(portValue, defaultPort) {
  if (portValue === undefined || portValue === '') {
    return defaultPort;
  }

  const parsed = parseInt(portValue, 10);

  // Check if parsing resulted in a valid number
  if (Number.isNaN(parsed)) {
    console.warn(
      `Warning: Invalid PORT value "${portValue}", using default ${defaultPort}`
    );
    return defaultPort;
  }

  // Validate port range (1-65535 for TCP/UDP ports)
  if (parsed < 1 || parsed > 65535) {
    throw new Error(
      `Invalid PORT value ${parsed}. Port must be between 1 and 65535.`
    );
  }

  // Warn about privileged ports that require elevated permissions
  if (parsed < 1024) {
    console.warn(
      `Warning: Port ${parsed} is a privileged port and may require elevated permissions.`
    );
  }

  return parsed;
}

/**
 * Validates the LOG_LEVEL environment variable against allowed values.
 *
 * @param {string|undefined} levelValue - The raw LOG_LEVEL environment variable value
 * @param {string} defaultLevel - The default log level to use if invalid
 * @returns {string} A valid log level string
 *
 * @private
 */
function parseLogLevel(levelValue, defaultLevel) {
  // Winston supported log levels (npm standard)
  const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

  if (levelValue === undefined || levelValue === '') {
    return defaultLevel;
  }

  const normalizedLevel = levelValue.toLowerCase().trim();

  if (!validLevels.includes(normalizedLevel)) {
    console.warn(
      `Warning: Invalid LOG_LEVEL "${levelValue}", using default "${defaultLevel}". ` +
      `Valid levels are: ${validLevels.join(', ')}`
    );
    return defaultLevel;
  }

  return normalizedLevel;
}

/**
 * Validates and normalizes the NODE_ENV environment variable.
 *
 * @param {string|undefined} envValue - The raw NODE_ENV environment variable value
 * @param {string} defaultEnv - The default environment to use
 * @returns {string} A normalized environment string
 *
 * @private
 */
function parseNodeEnv(envValue, defaultEnv) {
  if (envValue === undefined || envValue === '') {
    return defaultEnv;
  }

  const normalizedEnv = envValue.toLowerCase().trim();

  // Warn about non-standard environment names for awareness
  const standardEnvs = ['development', 'production', 'test', 'staging'];
  if (!standardEnvs.includes(normalizedEnv)) {
    console.warn(
      `Warning: Non-standard NODE_ENV "${normalizedEnv}". ` +
      `Standard values are: ${standardEnvs.join(', ')}`
    );
  }

  return normalizedEnv;
}

/**
 * Centralized application configuration object.
 *
 * This object consolidates all environment-based configuration settings,
 * providing validated and typed access to server, environment, and logging
 * configuration values.
 *
 * @typedef {Object} Config
 * @property {number} port - Server port number (1-65535)
 * @property {string} host - Server bind address
 * @property {string} nodeEnv - Current Node.js environment
 * @property {boolean} isDevelopment - True if not in production mode
 * @property {boolean} isProduction - True if in production mode
 * @property {string} logLevel - Winston log level
 */

/**
 * Server configuration settings.
 *
 * @description
 * - port: The TCP port the server binds to. Sourced from PORT env var.
 *         Default: 3000. Must be valid port number (1-65535).
 *         Original source: server.js line 44
 *
 * - host: The network interface address to bind to. Sourced from HOST env var.
 *         Default: '0.0.0.0' (all interfaces) for production accessibility.
 *         Note: Changed from original '127.0.0.1' per Agent Action Plan Section 0.7.3
 *         Original source: server.js line 33
 */
const serverConfig = {
  /**
   * Server port number.
   * @type {number}
   * @default 3000
   * @env PORT
   */
  port: parsePort(process.env.PORT, 3000),

  /**
   * Server bind address.
   * Use '0.0.0.0' to accept connections from all network interfaces (production).
   * Use '127.0.0.1' to accept only local connections (development security).
   * @type {string}
   * @default '0.0.0.0'
   * @env HOST
   */
  host: process.env.HOST || '0.0.0.0',
};

/**
 * Environment configuration settings.
 *
 * @description
 * - nodeEnv: The current environment mode. Affects logging, error detail, and
 *            behavior throughout the application. Common values: 'development',
 *            'production', 'test', 'staging'.
 *
 * - isDevelopment: Convenience boolean for conditional development features.
 *                  True when NOT in production mode.
 *
 * - isProduction: Convenience boolean for conditional production optimizations.
 *                 True only when NODE_ENV is exactly 'production'.
 */
const environmentConfig = {
  /**
   * Current Node.js environment mode.
   * @type {string}
   * @default 'development'
   * @env NODE_ENV
   */
  nodeEnv: parseNodeEnv(process.env.NODE_ENV, 'development'),

  /**
   * Boolean flag indicating development mode (non-production).
   * Useful for enabling verbose logging, detailed error messages, etc.
   * @type {boolean}
   */
  isDevelopment: parseNodeEnv(process.env.NODE_ENV, 'development') !== 'production',

  /**
   * Boolean flag indicating production mode.
   * Useful for enabling optimizations, hiding stack traces, etc.
   * @type {boolean}
   */
  isProduction: parseNodeEnv(process.env.NODE_ENV, 'development') === 'production',
};

/**
 * Logging configuration settings.
 *
 * @description
 * - logLevel: Controls the verbosity of Winston logger output.
 *             Valid levels (in order of priority): error, warn, info, http, verbose, debug, silly.
 *             Messages at or above the configured level will be logged.
 */
const loggingConfig = {
  /**
   * Winston log level.
   * Controls which log messages are output based on severity.
   * @type {string}
   * @default 'info'
   * @env LOG_LEVEL
   */
  logLevel: parseLogLevel(process.env.LOG_LEVEL, 'info'),
};

/**
 * Merged configuration object exported for use throughout the application.
 *
 * @type {Config}
 * @example
 * const config = require('./config');
 *
 * // Server configuration
 * console.log(config.port);    // 3000
 * console.log(config.host);    // '0.0.0.0'
 *
 * // Environment checks
 * if (config.isProduction) {
 *   // Production-specific setup
 * }
 *
 * // Logging configuration
 * console.log(config.logLevel); // 'info'
 */
const config = {
  // Server settings (from original server.js environment handling)
  port: serverConfig.port,
  host: serverConfig.host,

  // Environment settings
  nodeEnv: environmentConfig.nodeEnv,
  isDevelopment: environmentConfig.isDevelopment,
  isProduction: environmentConfig.isProduction,

  // Logging settings
  logLevel: loggingConfig.logLevel,
};

// Freeze the configuration object to prevent runtime modifications
// This ensures configuration immutability throughout the application lifecycle
Object.freeze(config);

/**
 * Export the configuration object as the module's default export.
 * Uses CommonJS module.exports pattern for consistency with the codebase.
 *
 * @exports config
 */
module.exports = config;
