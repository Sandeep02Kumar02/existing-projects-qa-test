// Security-enhanced Node.js server with Express framework
// Implements comprehensive security controls: headers, rate limiting, CORS, input validation, HTTPS

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration with environment variable support for production flexibility
// Motive: Allow deployment-time configuration without code changes, following 12-factor app principles
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express application
const app = express();

// Remove Express signature for security through obscurity
app.disable('x-powered-by');

// ============================================================================
// SECURITY MIDDLEWARE STACK
// ============================================================================

// Configure Helmet security headers
// Motive: Protect against XSS, clickjacking, MIME-sniffing, and other client-side attacks
// Sets 12+ security headers following OWASP recommendations
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false
  }
}));

// Configure rate limiting
// Motive: Prevent DoS attacks, brute-force attempts, and resource exhaustion
// Implements sliding window algorithm with IP-based tracking
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: 'Too many requests, please try again later',
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again after 15 minutes'
    });
  }
});

app.use(limiter);

// Configure CORS policy
// Motive: Control cross-origin access with whitelist approach, preventing unauthorized domains
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8080'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false, // Don't allow credentials for security
  maxAge: 86400 // 24 hours preflight cache
};

app.use(cors(corsOptions));

// Input validation middleware
// Motive: Validate and sanitize all incoming requests before processing
// Prevents path traversal, method exploitation, and payload bombs
const validateRequest = (req, res, next) => {
  // Validate HTTP method
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Prevent path traversal
  if (req.path.includes('..') || req.path.includes('\\')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  
  // Validate Content-Type for POST/PUT
  if (['POST', 'PUT'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    const allowedTypes = ['application/json', 'application/x-www-form-urlencoded', 'text/plain'];
    if (contentType && !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({ error: 'Unsupported Media Type' });
    }
  }
  
  // Validate Content-Length (prevent payload bombs)
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({ error: 'Payload too large' });
  }
  
  next();
};

app.use(validateRequest);

// ============================================================================
// APPLICATION ROUTES
// ============================================================================

// Main route - preserves exact original response
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

// Health check endpoint for monitoring and load balancer health checks
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Express error handler
// Motive: Centralized error handling with environment-aware error exposure
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't expose error details in production
  // Motive: Prevent information disclosure while aiding development debugging
  const errorResponse = NODE_ENV === 'production'
    ? { error: 'Internal Server Error' }
    : { error: err.message, stack: err.stack };
  
  res.status(err.status || 500).json(errorResponse);
});

// ============================================================================
// SERVER CREATION AND STARTUP
// ============================================================================

// Create HTTP server with Express app
const httpServer = http.createServer(app);

// Handle server-level errors (e.g., port already in use, permission denied)
// Motive: Prevent unhandled server binding failures from crashing process with unclear error messages
httpServer.on('error', (error) => {
  console.error('HTTP Server error:', error.message);
  
  // Provide specific guidance for common errors
  // Motive: Help operators quickly identify and resolve deployment issues
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${PORT}`);
  }
  
  process.exit(1);
});

// Handle client connection errors
// Motive: Prevent malformed requests or client errors from leaking sockets or crashing server
httpServer.on('clientError', (error, socket) => {
  console.error('Client connection error:', error.message);
  
  // Send HTTP 400 response if socket is still writable
  // Motive: Inform client of error condition before closing connection
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } else {
    socket.destroy();
  }
});

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`HTTP Server listening on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log('Press Ctrl+C to stop the server');
});

// HTTPS server (optional, enabled via environment variable)
// Motive: Enable TLS/SSL encryption for production deployments while keeping HTTP for development
let httpsServer = null;

if (ENABLE_HTTPS) {
  const certDir = process.env.CERT_DIR || path.join(__dirname, 'certs');
  
  try {
    const httpsOptions = {
      key: fs.readFileSync(path.join(certDir, 'key.pem')),
      cert: fs.readFileSync(path.join(certDir, 'cert.pem'))
      // Optional: Add CA bundle if using intermediate certificates
      // ca: fs.readFileSync(path.join(certDir, 'ca.pem'))
    };
    
    httpsServer = https.createServer(httpsOptions, app);
    
    // Handle HTTPS server errors
    httpsServer.on('error', (error) => {
      console.error('HTTPS Server error:', error.message);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${HTTPS_PORT} is already in use`);
      } else if (error.code === 'EACCES') {
        console.error(`Permission denied to bind to port ${HTTPS_PORT}`);
      }
      
      process.exit(1);
    });
    
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS Server listening on port ${HTTPS_PORT}`);
    });
    
  } catch (error) {
    console.error('HTTPS server failed to start:', error.message);
    console.error('Ensure certificates exist in', certDir);
    console.error('Generate certificates with: npm run generate-certs');
    console.error('Or manually: openssl req -x509 -newkey rsa:4096 -nodes -keyout certs/key.pem -out certs/cert.pem -days 365');
  }
}

// Graceful shutdown function with timeout
// Motive: Ensure in-flight requests complete before shutdown, preventing client errors during deployments
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections on HTTP server
  // Motive: Drain existing connections while rejecting new ones
  httpServer.close(() => {
    console.log('HTTP server closed. All connections finished.');
    
    // If HTTPS server exists, close it too
    if (httpsServer) {
      httpsServer.close(() => {
        console.log('HTTPS server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
  
  // Force shutdown after timeout if connections don't close naturally
  // Motive: Prevent hung processes if connections don't drain within reasonable time
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Handle graceful shutdown signals
// Motive: Support standard Unix process management (kill, systemd, Docker, Kubernetes)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// PROCESS-LEVEL ERROR HANDLERS
// ============================================================================

// Handle uncaught exceptions (last resort error handler)
// Motive: Log unexpected errors and attempt graceful shutdown instead of silent crash
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', error.name, error.message);
  console.error('Stack:', error.stack);
  
  // Attempt graceful shutdown, then force exit
  // Motive: Per Node.js best practices, do not continue after uncaught exception
  httpServer.close(() => {
    console.log('HTTP server closed due to uncaught exception');
    
    if (httpsServer) {
      httpsServer.close(() => {
        console.log('HTTPS server closed due to uncaught exception');
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
  
  // Force exit if server doesn't close in time
  // Motive: Prevent hung process in corrupted state
  setTimeout(() => {
    console.error('Forcing exit after uncaught exception');
    process.exit(1);
  }, 5000);
});

// Handle unhandled promise rejections
// Motive: Catch async errors that slip through without .catch() handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION! Shutting down...');
  console.error('Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Treat unhandled rejections as critical errors
  // Motive: Prevent silent failures and data corruption from unhandled async errors
  httpServer.close(() => {
    console.log('HTTP server closed due to unhandled rejection');
    
    if (httpsServer) {
      httpsServer.close(() => {
        console.log('HTTPS server closed due to unhandled rejection');
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
  
  // Force exit if server doesn't close in time
  // Motive: Ensure process doesn't hang in undefined state
  setTimeout(() => {
    console.error('Forcing exit after unhandled rejection');
    process.exit(1);
  }, 5000);
});
