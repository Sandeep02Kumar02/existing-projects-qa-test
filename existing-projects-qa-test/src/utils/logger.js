/**
 * @fileoverview Winston logger configuration module providing centralized logging
 * infrastructure for the Express.js application.
 *
 * This module configures a Winston logger singleton with multiple transports:
 * - Colored console output for development visibility
 * - JSON-formatted file output for production log aggregation
 * - Separate error file transport for critical issues
 *
 * Replaces all console.log/console.error calls from the original server.js with
 * structured, configurable logging supporting multiple log levels (error, warn,
 * info, http, debug).
 *
 * Integration with Morgan HTTP request logging is provided via the logger.stream
 * property, which writes Morgan output to the 'http' log level.
 *
 * @module utils/logger
 * @requires winston
 * @requires path
 * @requires fs
 * @requires config
 * @author Blitzy Platform
 * @license MIT
 *
 * @example
 * // Import the logger singleton
 * const logger = require('./utils/logger');
 *
 * // Use various log levels
 * logger.info('Application started');
 * logger.error('Critical error occurred', { code: 'ERR_001', details: err.message });
 * logger.warn('Deprecated feature used');
 * logger.debug('Debug information', { data: someObject });
 *
 * // Use with Morgan middleware
 * const morgan = require('morgan');
 * app.use(morgan('combined', { stream: logger.stream }));
 *
 * @see {@link https://github.com/winstonjs/winston|Winston Documentation}
 */

'use strict';

// =============================================================================
// IMPORTS
// =============================================================================

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Log directory path for file transports.
 * Logs are stored in the 'logs' directory at the project root.
 * @const {string}
 */
const LOG_DIR = path.join(process.cwd(), 'logs');

/**
 * Maximum log file size before rotation (5MB).
 * @const {number}
 */
const MAX_FILE_SIZE = 5242880; // 5MB in bytes

/**
 * Maximum number of rotated log files to keep.
 * @const {number}
 */
const MAX_FILES = 5;

// =============================================================================
// LOG LEVELS CONFIGURATION
// =============================================================================

/**
 * Custom log levels following Winston/npm conventions with numeric priorities.
 * Lower numbers indicate higher severity.
 *
 * Level Priorities:
 * - error (0): Critical errors requiring immediate attention
 * - warn (1): Warning conditions that should be addressed
 * - info (2): Informational messages about normal operation
 * - http (3): HTTP request logging for Morgan integration
 * - debug (4): Debug information for development and troubleshooting
 *
 * @const {Object<string, number>}
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Custom color mappings for each log level.
 * Colors are applied to console output for improved readability.
 *
 * @const {Object<string, string>}
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Register custom colors with Winston
// This must be called before creating the logger to ensure colors are available
winston.addColors(colors);

// =============================================================================
// FORMAT CONFIGURATIONS
// =============================================================================

/**
 * Console format configuration for development output.
 * Includes colorization, timestamp, and custom printf formatting.
 *
 * Format: [YYYY-MM-DD HH:mm:ss] level: message {metadata}
 *
 * @const {winston.Logform.Format}
 */
const consoleFormat = winston.format.combine(
  // Add colors to the log level in output
  winston.format.colorize({ all: true }),
  // Add ISO timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  // Custom printf for readable console output
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    // Build metadata string if additional data is present
    let metaString = '';
    if (Object.keys(metadata).length > 0) {
      metaString = ` ${JSON.stringify(metadata)}`;
    }
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * File format configuration for production log aggregation.
 * Outputs JSON format for easy parsing by log aggregation tools.
 *
 * @const {winston.Logform.Format}
 */
const fileFormat = winston.format.combine(
  // Add ISO timestamp for chronological sorting
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  // Include error stack traces in output
  winston.format.errors({ stack: true }),
  // Output as JSON for structured logging
  winston.format.json()
);

// =============================================================================
// LOGS DIRECTORY INITIALIZATION
// =============================================================================

/**
 * Ensures the logs directory exists before creating file transports.
 * Creates the directory recursively if it doesn't exist.
 *
 * This is performed synchronously at module load time to ensure the directory
 * exists before any log writes are attempted.
 */
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    // Fallback to console if we can't create log directory
    // This shouldn't happen in normal operation but prevents crashes
    console.error(`Failed to create logs directory: ${err.message}`);
  }
}

// =============================================================================
// TRANSPORTS CONFIGURATION
// =============================================================================

/**
 * Winston transports array configuration.
 *
 * Transports:
 * 1. Console transport - Colored output for development and runtime visibility
 * 2. Combined file transport - All logs at or above configured level to combined.log
 * 3. Error file transport - Only error-level logs to error.log
 *
 * @const {Array<winston.transport>}
 */
const transports = [
  // Console transport for development and runtime visibility
  // Level is controlled by config.logLevel for environment-specific verbosity
  new winston.transports.Console({
    level: config.logLevel,
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true,
  }),

  // Combined log file for all logs at or above configured level
  // JSON format enables parsing by log aggregation systems (ELK, Splunk, etc.)
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    level: config.logLevel,
    format: fileFormat,
    maxsize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    handleExceptions: true,
    handleRejections: true,
  }),

  // Error log file for error-level logs only
  // Separating errors makes it easier to monitor critical issues
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    handleExceptions: true,
    handleRejections: true,
  }),
];

// =============================================================================
// LOGGER INSTANCE CREATION
// =============================================================================

/**
 * Winston logger instance configured for the Express.js application.
 *
 * This logger provides centralized, structured logging with multiple output
 * destinations. It replaces all console.log/console.error calls from the
 * original server.js implementation with configurable, level-based logging.
 *
 * Available methods:
 * - logger.error(message, [metadata]) - Critical errors (level 0)
 * - logger.warn(message, [metadata]) - Warning conditions (level 1)
 * - logger.info(message, [metadata]) - Informational messages (level 2)
 * - logger.http(message, [metadata]) - HTTP request logs (level 3)
 * - logger.debug(message, [metadata]) - Debug information (level 4)
 *
 * @type {winston.Logger}
 *
 * @example
 * // Basic logging
 * logger.info('Server starting...');
 * logger.error('Database connection failed', { host: 'localhost', port: 5432 });
 *
 * @example
 * // Replace original server.js console.error calls
 * // Original: console.error('Server error:', error.message);
 * // Replaced: logger.error('Server error', { message: error.message });
 */
const logger = winston.createLogger({
  // Use custom log levels defined above
  levels: levels,

  // Default level from environment configuration
  // This sets the minimum level that will be logged
  level: config.logLevel,

  // Base format applied to all transports
  // Additional formatting is applied per-transport
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),

  // Configured transports array
  transports: transports,

  // Don't exit on handled exceptions - let the application handle shutdown
  exitOnError: false,
});

// =============================================================================
// MORGAN INTEGRATION
// =============================================================================

/**
 * Stream object for Morgan HTTP request logging integration.
 *
 * This stream writes Morgan log output to Winston at the 'http' log level,
 * unifying all application logging through a single logger instance.
 *
 * The write function trims trailing newlines from Morgan messages before
 * passing them to Winston, as Morgan appends newlines by default.
 *
 * @type {Object}
 * @property {Function} write - Stream write function for Morgan
 *
 * @example
 * // Usage with Morgan middleware in Express app
 * const morgan = require('morgan');
 * const logger = require('./utils/logger');
 *
 * // Use 'combined' format for production, 'dev' for development
 * const format = config.isProduction ? 'combined' : 'dev';
 * app.use(morgan(format, { stream: logger.stream }));
 */
logger.stream = {
  /**
   * Write function for Morgan integration.
   * Trims trailing newline characters before passing to Winston.
   *
   * @param {string} message - Log message from Morgan HTTP logger
   * @returns {void}
   */
  write: (message) => {
    // Remove trailing newline that Morgan adds by default
    // This prevents double line breaks in log output
    logger.http(message.trim());
  },
};

// =============================================================================
// DEVELOPMENT LOGGING ENHANCEMENT
// =============================================================================

/**
 * In development mode, add debug context to help with troubleshooting.
 * This conditional logging helps identify environment-specific issues.
 */
if (config.isDevelopment) {
  logger.debug('Logger initialized', {
    level: config.logLevel,
    environment: config.nodeEnv || 'development',
    logDirectory: LOG_DIR,
    transports: ['console', 'combined.log', 'error.log'],
  });
}

// =============================================================================
// MODULE EXPORT
// =============================================================================

/**
 * Export the logger instance as a singleton.
 *
 * The logger is exported as the default module export with the stream
 * property attached for Morgan integration.
 *
 * Exported Properties:
 * - error() - Log error level messages
 * - warn() - Log warning level messages
 * - info() - Log info level messages
 * - http() - Log HTTP request messages (for Morgan)
 * - debug() - Log debug level messages
 * - stream - Object with write() function for Morgan integration
 *
 * @exports logger
 * @type {winston.Logger}
 *
 * @example
 * // CommonJS import
 * const logger = require('./utils/logger');
 *
 * // Log messages at various levels
 * logger.info('Server started successfully');
 * logger.error('Failed to connect to database', { error: err.message });
 *
 * // Use stream with Morgan
 * app.use(morgan('combined', { stream: logger.stream }));
 */
module.exports = logger;
