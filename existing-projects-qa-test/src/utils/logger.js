/**
 * @fileoverview Winston logger configuration for the Express.js application.
 *
 * This module creates and exports a configured Winston logger instance with
 * console and file transports for comprehensive logging. It integrates with
 * Morgan for HTTP request logging and provides structured logging output.
 *
 * @module utils/logger
 * @requires winston
 * @requires config
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * const logger = require('./utils/logger');
 *
 * logger.info('Application started');
 * logger.error('Something went wrong', { error: err.message });
 * logger.debug('Debug information', { data: someObject });
 *
 * @see {@link https://github.com/winstonjs/winston|Winston Documentation}
 */

'use strict';

const winston = require('winston');
const path = require('path');
const config = require('../config');

/**
 * Log directory path for file transports.
 * Logs are stored in the 'logs' directory at the project root.
 * @const {string}
 */
const LOG_DIR = path.join(process.cwd(), 'logs');

/**
 * Custom log format for console output (development).
 * Includes colorized level, timestamp, and message with optional metadata.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let metaString = '';
    if (Object.keys(metadata).length > 0) {
      metaString = ` ${JSON.stringify(metadata)}`;
    }
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * Custom log format for file output (JSON format for parsing).
 * Includes timestamp, level, message, and all metadata as JSON.
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Winston logger transports configuration.
 * - Console transport: Colored output for development visibility
 * - Combined file: All log levels (info and above) to combined.log
 * - Error file: Only error level logs to error.log
 */
const transports = [
  // Console transport for development and runtime visibility
  new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
  }),

  // Combined log file for all levels at or above configured level
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    handleExceptions: true,
  }),

  // Error log file for error-level logs only
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    handleExceptions: true,
  }),
];

/**
 * Winston logger instance configured for the application.
 *
 * Log Levels (npm standard):
 * - error: 0 - Critical errors requiring immediate attention
 * - warn: 1 - Warning conditions that should be addressed
 * - info: 2 - Informational messages about normal operation
 * - http: 3 - HTTP request logging (Morgan integration)
 * - verbose: 4 - Detailed information for troubleshooting
 * - debug: 5 - Debug information for development
 * - silly: 6 - Extremely detailed tracing information
 *
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports,
  exitOnError: false,
});

/**
 * Stream object for Morgan HTTP request logging integration.
 * Writes Morgan log output to Winston at the 'http' log level.
 *
 * @type {Object}
 * @property {Function} write - Writes Morgan log message to Winston
 *
 * @example
 * const morgan = require('morgan');
 * const { stream } = require('./utils/logger');
 *
 * app.use(morgan('combined', { stream }));
 */
const stream = {
  /**
   * Write function for Morgan integration.
   * Trims newline characters before passing to Winston.
   *
   * @param {string} message - Log message from Morgan
   */
  write: (message) => {
    // Remove trailing newline from Morgan messages
    logger.http(message.trim());
  },
};

// Create logs directory if it doesn't exist (handled at startup)
const fs = require('fs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Export logger instance and Morgan stream.
 * - logger: The Winston logger instance
 * - stream: Morgan stream object for HTTP request logging
 */
module.exports = logger;
module.exports.stream = stream;
