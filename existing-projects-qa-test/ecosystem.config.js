/**
 * @fileoverview PM2 Ecosystem Configuration File
 * 
 * This configuration file defines the PM2 process manager settings for deploying
 * the Express.js application in production environments. It configures clustering
 * for multi-core utilization, automatic restart policies, memory limits, and
 * environment-specific variables.
 * 
 * @module ecosystem.config
 * @see {@link https://pm2.keymetrics.io/docs/usage/application-declaration/|PM2 Application Declaration}
 * 
 * @description
 * Key Features:
 * - Cluster mode for utilizing all available CPU cores
 * - Automatic restart on crashes and memory threshold breaches
 * - Environment-specific configurations (development, production)
 * - Structured logging with timestamps
 * - Zero-downtime restart capability
 * 
 * @example
 * // Start the application with PM2 in development mode
 * pm2 start ecosystem.config.js
 * 
 * @example
 * // Start the application with PM2 in production mode
 * pm2 start ecosystem.config.js --env production
 * 
 * @example
 * // Reload the application with zero-downtime (cluster mode)
 * pm2 reload ecosystem.config.js
 * 
 * @example
 * // Stop the application
 * pm2 stop ecosystem.config.js
 * 
 * @example
 * // Delete the application from PM2 process list
 * pm2 delete ecosystem.config.js
 * 
 * @example
 * // View logs
 * pm2 logs hello-world
 * 
 * @example
 * // Monitor processes
 * pm2 monit
 */

module.exports = {
  /**
   * Application configuration array
   * Each object in this array represents a separate application managed by PM2
   */
  apps: [
    {
      /**
       * Application name identifier
       * Used for PM2 process identification and log file naming
       * @type {string}
       */
      name: 'hello-world',

      /**
       * Entry point script for the application
       * Path is relative to the ecosystem.config.js file location
       * @type {string}
       */
      script: 'src/server.js',

      /**
       * Process execution mode
       * - 'cluster': Enables Node.js cluster mode for multi-core utilization
       *              Allows zero-downtime reloads and load balancing
       * - 'fork': Single process mode (default)
       * @type {string}
       */
      exec_mode: 'cluster',

      /**
       * Number of instances to spawn
       * - 'max': Automatically detect and use all available CPU cores
       * - number: Spawn a specific number of instances
       * Recommended: 'max' for production to fully utilize server resources
       * @type {string|number}
       */
      instances: 'max',

      /**
       * Automatic restart when process crashes
       * Ensures high availability by automatically recovering from crashes
       * @type {boolean}
       */
      autorestart: true,

      /**
       * Memory threshold for automatic restart
       * When a process exceeds this memory limit, PM2 will restart it
       * Helps prevent memory leaks from causing system-wide issues
       * Format: '300M' (megabytes), '1G' (gigabytes)
       * @type {string}
       */
      max_memory_restart: '300M',

      /**
       * File watching for automatic restart on file changes
       * - false: Recommended for production (no auto-restart on file changes)
       * - true: Useful for development (restarts when files change)
       * Note: In production, use 'pm2 reload' for zero-downtime deployments
       * @type {boolean}
       */
      watch: false,

      /**
       * Files/directories to ignore when watch is enabled
       * Only applicable when watch: true
       * @type {string[]}
       */
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '*.log'
      ],

      /**
       * Maximum number of restarts within a time window before stopping restart attempts
       * Prevents infinite restart loops in case of persistent errors
       * @type {number}
       */
      max_restarts: 10,

      /**
       * Minimum uptime before considering the application as successfully started
       * If the app crashes before this time, it's considered an unstable start
       * @type {string}
       */
      min_uptime: '5s',

      /**
       * Time to wait between restarts when application crashes
       * Gives the system time to recover and prevents rapid restart cycles
       * @type {number} Time in milliseconds
       */
      restart_delay: 4000,

      /**
       * Graceful shutdown timeout
       * Time to wait for the application to handle SIGINT before forcing kill
       * Allows in-flight requests to complete before shutdown
       * @type {number} Time in milliseconds
       */
      kill_timeout: 30000,

      /**
       * Wait for ready signal from application before considering it online
       * When enabled, the app should call process.send('ready') when ready
       * @type {boolean}
       */
      wait_ready: false,

      /**
       * Listen timeout for cluster mode
       * Maximum time to wait for a worker to be listening
       * @type {number} Time in milliseconds
       */
      listen_timeout: 8000,

      /**
       * Log date format for timestamps in log output
       * Uses moment.js format syntax
       * @type {string}
       */
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      /**
       * Combine stdout and stderr logs into one file
       * Set to false to keep error and output logs separate
       * @type {boolean}
       */
      merge_logs: true,

      /**
       * Standard output log file path
       * Stores all console.log and stdout output
       * @type {string}
       */
      out_file: 'logs/hello-world-out.log',

      /**
       * Error output log file path
       * Stores all console.error and stderr output
       * @type {string}
       */
      error_file: 'logs/hello-world-error.log',

      /**
       * Combined log file path (when merge_logs is true)
       * Contains both stdout and stderr combined
       * @type {string}
       */
      log_file: 'logs/hello-world-combined.log',

      /**
       * Development environment variables
       * Applied by default when starting with: pm2 start ecosystem.config.js
       * @type {Object}
       */
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'debug'
      },

      /**
       * Production environment variables
       * Applied when starting with: pm2 start ecosystem.config.js --env production
       * @type {Object}
       */
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info'
      },

      /**
       * Staging environment variables
       * Applied when starting with: pm2 start ecosystem.config.js --env staging
       * @type {Object}
       */
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'debug'
      },

      /**
       * Test environment variables
       * Applied when starting with: pm2 start ecosystem.config.js --env test
       * @type {Object}
       */
      env_test: {
        NODE_ENV: 'test',
        PORT: 3001,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'error'
      },

      /**
       * Source map support for better error stack traces
       * Useful when using transpiled code (TypeScript, Babel)
       * @type {boolean}
       */
      source_map_support: false,

      /**
       * Node.js arguments to pass to the interpreter
       * Example: ['--max-old-space-size=4096'] for increased memory limit
       * @type {string[]}
       */
      node_args: [],

      /**
       * Interpreter to use for executing the script
       * @type {string}
       */
      interpreter: 'node',

      /**
       * Working directory for the application
       * Uses current directory by default when not specified
       * @type {string}
       */
      cwd: './',

      /**
       * Instance variable for cluster mode
       * Automatically set by PM2 to identify each instance
       * Accessible in app via process.env.NODE_APP_INSTANCE
       * @type {boolean}
       */
      instance_var: 'INSTANCE_ID',

      /**
       * Filter environment variables to prevent leaking sensitive data to logs
       * @type {string[]}
       */
      filter_env: [],

      /**
       * Automation configuration for deployment lifecycle hooks
       * Useful for CI/CD integration
       */
      automation: false,

      /**
       * Force using PM2 cron restart (alternative to external cron)
       * Example: '0 0 * * *' to restart daily at midnight
       * @type {string|boolean}
       */
      cron_restart: false,

      /**
       * Vizion (git integration) support for deployment tracking
       * Enables git metadata in PM2 dashboard
       * @type {boolean}
       */
      vizion: true,

      /**
       * Post-update commands to run after pm2 pull
       * Useful for running migrations or rebuilds after deployment
       * @type {string[]}
       */
      post_update: [
        'npm install'
      ],

      /**
       * Exponential backoff restart delay configuration
       * Increases delay between restarts for persistent crash scenarios
       * Helps prevent overwhelming system resources during issues
       */
      exp_backoff_restart_delay: 100
    }
  ],

  /**
   * Deployment configuration for remote server deployments
   * Use with: pm2 deploy ecosystem.config.js production setup
   *           pm2 deploy ecosystem.config.js production
   * 
   * Note: Uncomment and configure these settings for your specific deployment environment
   */
  deploy: {
    /**
     * Production deployment configuration
     */
    production: {
      /**
       * SSH user for deployment
       * @type {string}
       */
      user: 'deploy',

      /**
       * Target server(s) for deployment
       * Can be a single host or array of hosts for multi-server deployment
       * @type {string|string[]}
       */
      host: ['server.example.com'],

      /**
       * Target git reference (branch, tag, or commit)
       * @type {string}
       */
      ref: 'origin/main',

      /**
       * Git repository URL
       * @type {string}
       */
      repo: 'git@github.com:username/repository.git',

      /**
       * Deployment path on the remote server
       * @type {string}
       */
      path: '/var/www/hello-world',

      /**
       * SSH options for deployment
       * @type {string}
       */
      ssh_options: 'StrictHostKeyChecking=no',

      /**
       * Pre-setup commands (run once before first deployment)
       * @type {string}
       */
      'pre-setup': 'echo "Running pre-setup"',

      /**
       * Post-setup commands (run once after first deployment)
       * @type {string}
       */
      'post-setup': 'npm install',

      /**
       * Pre-deploy commands (run before each deployment)
       * @type {string}
       */
      'pre-deploy': 'git fetch --all',

      /**
       * Post-deploy commands (run after each deployment)
       * @type {string}
       */
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',

      /**
       * Pre-deploy commands on local machine
       * @type {string}
       */
      'pre-deploy-local': 'echo "Deploying to production"',

      /**
       * Environment variables for deployment
       * @type {Object}
       */
      env: {
        NODE_ENV: 'production'
      }
    },

    /**
     * Staging deployment configuration
     */
    staging: {
      user: 'deploy',
      host: ['staging.example.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:username/repository.git',
      path: '/var/www/hello-world-staging',
      ssh_options: 'StrictHostKeyChecking=no',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
