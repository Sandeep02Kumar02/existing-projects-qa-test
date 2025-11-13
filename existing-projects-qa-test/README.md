# Secure Hello World Server

A production-ready Node.js HTTP server with comprehensive security enhancements including Express framework, security headers, rate limiting, CORS policies, input validation, and HTTPS support.

## Security Features

This server implements enterprise-grade security controls to protect against common web vulnerabilities:

### 🛡️ Security Headers (via Helmet.js)

The server automatically applies 12+ security headers to protect against various attacks:

- **Content-Security-Policy (CSP)**: Prevents XSS attacks by controlling resource loading
- **Strict-Transport-Security (HSTS)**: Enforces HTTPS connections (when HTTPS enabled)
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Stops MIME-sniffing vulnerabilities
- **Referrer-Policy**: Controls information leakage via referrer headers
- **Cross-Origin-Opener-Policy**: Protects against Spectre-like attacks
- **Cross-Origin-Resource-Policy**: Prevents cross-origin data leaks
- **X-DNS-Prefetch-Control**: Prevents information disclosure via DNS

### 🚦 Rate Limiting

- **Protection**: Prevents DoS attacks, brute-force attempts, and resource exhaustion
- **Configuration**: 100 requests per 15-minute window per IP address
- **Algorithm**: Sliding window for accurate rate limiting
- **Response**: Returns HTTP 429 (Too Many Requests) when limit exceeded
- **Headers**: Includes RateLimit-* headers for client awareness

### ✅ Input Validation

Validates all incoming requests before processing:

- **HTTP Method Validation**: Only allows GET, POST, PUT, DELETE, OPTIONS, HEAD
- **Path Traversal Prevention**: Blocks attempts to access unauthorized paths
- **Content-Type Validation**: Ensures proper content types for POST/PUT requests
- **Payload Size Limits**: Rejects requests larger than 10MB
- **Automatic Error Responses**: Returns appropriate HTTP status codes (400, 405, 413, 415)

### 🌐 CORS Policy

Controls cross-origin access with whitelist approach:

- **Default Allowed Origins**: http://localhost:3000, http://localhost:8080
- **Configurable**: Set via ALLOWED_ORIGINS environment variable
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization
- **Credentials**: Disabled by default for security
- **Preflight Caching**: 24-hour cache for OPTIONS requests

### 🔒 HTTPS Support

Optional TLS/SSL encryption for production deployments:

- **Environment-Based**: Enable via ENABLE_HTTPS=true
- **Dual Mode**: Can run HTTP and HTTPS simultaneously
- **Certificate Management**: Loads certificates from filesystem
- **Development**: Self-signed certificates for local testing
- **Production**: Supports CA-signed certificates (Let's Encrypt, DigiCert, etc.)

## Installation

```bash
# Install dependencies
npm install

# Verify installation
npm list --depth=0
```

## Running the Server

### Development Mode (HTTP only)

```bash
npm start
```

Server will start on http://localhost:3000 (or PORT environment variable)

### Production Mode (with HTTPS)

```bash
npm run start:https
```

Server will start on:
- HTTP: http://localhost:3000
- HTTPS: https://localhost:3443

## HTTPS Configuration

### Development: Self-Signed Certificates

For local development and testing:

```bash
# Generate self-signed certificates (valid for 365 days)
npm run generate-certs
```

This creates:
- `certs/key.pem` - Private key
- `certs/cert.pem` - Self-signed certificate

**Note**: Browsers will show security warnings for self-signed certificates. This is expected and safe for development.

### Production: CA-Signed Certificates

For production deployments, use certificates from a trusted Certificate Authority:

#### Option 1: Let's Encrypt (Recommended - Free)

```bash
# Install Certbot
sudo apt-get install certbot  # Debian/Ubuntu
# or
brew install certbot  # macOS

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to project
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/key.pem
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/cert.pem
```

#### Option 2: Commercial CA (DigiCert, GoDaddy, etc.)

1. Generate a Certificate Signing Request (CSR)
2. Submit CSR to your chosen CA
3. Receive signed certificate and intermediate certificates
4. Place files in `certs/` directory as `key.pem` and `cert.pem`

#### Certificate Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
# Add to crontab for automatic renewal
0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /path/to/project/certs/
```

## Environment Variables

Configure the server using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `HTTPS_PORT` | 3443 | HTTPS server port |
| `ENABLE_HTTPS` | false | Enable HTTPS server (set to "true" to enable) |
| `ALLOWED_ORIGINS` | localhost:3000,localhost:8080 | Comma-separated list of allowed CORS origins |
| `CERT_DIR` | ./certs | Directory containing SSL/TLS certificates |
| `NODE_ENV` | development | Environment: development or production |

### Example Configuration

**Development (.env file)**:
```bash
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://localhost:4200
```

**Production (.env file)**:
```bash
PORT=80
HTTPS_PORT=443
ENABLE_HTTPS=true
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
CERT_DIR=/etc/ssl/certs/production
```

## CORS Configuration

### Adding Allowed Origins

To allow additional origins to access your API:

```bash
# Single origin
ALLOWED_ORIGINS=https://yourdomain.com

# Multiple origins (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,https://admin.yourdomain.com
```

### Troubleshooting CORS Issues

If you see CORS errors in the browser console:

1. **Check the origin is whitelisted**: Verify ALLOWED_ORIGINS includes your frontend domain
2. **Check the protocol**: Ensure you're using the correct protocol (http vs https)
3. **Check the port**: Include the port if it's not standard (80/443)
4. **Check browser console**: Look for detailed CORS error messages

**Example CORS Error**:
```
Access to fetch at 'http://localhost:3000' from origin 'http://localhost:4200'
has been blocked by CORS policy
```

**Solution**: Add `http://localhost:4200` to ALLOWED_ORIGINS

## Security Best Practices

### For Development

1. **Use self-signed certificates** for HTTPS testing: `npm run generate-certs`
2. **Enable relaxed CORS** for local development tools
3. **Monitor rate limit logs** to adjust thresholds if needed
4. **Use NODE_ENV=development** to see detailed error messages

### For Production

1. **Always use HTTPS** with CA-signed certificates
2. **Restrict CORS origins** to your actual frontend domains only
3. **Use NODE_ENV=production** to hide error details from clients
4. **Keep dependencies updated**: Run `npm audit` regularly
5. **Monitor security logs**: Watch for rate limit violations and blocked requests
6. **Implement certificate renewal**: Automate Let's Encrypt renewal
7. **Use environment variables**: Never hardcode secrets or configuration
8. **Enable HSTS preload** once HTTPS is stable (update helmet configuration)
9. **Review CSP directives** if adding frontend frameworks that need specific permissions
10. **Consider Redis** for rate limiting in multi-instance deployments

### Security Monitoring

The server logs security-related events to console:

- **Rate limit violations**: Shows IP address when limits are exceeded
- **CORS blocks**: Logs when requests from unauthorized origins are blocked
- **Validation failures**: Records invalid requests (method, path, payload)

## Testing the Server

### Basic Functionality Test

```bash
# Start server
npm start

# In another terminal, test the endpoint
curl http://localhost:3000/
# Expected output: Hello, World!
```

### Security Headers Test

```bash
# View all response headers
curl -I http://localhost:3000/

# Check for specific security headers
curl -I http://localhost:3000/ | grep -E "(Content-Security-Policy|Strict-Transport-Security|X-Frame-Options)"
```

### Rate Limiting Test

```bash
# Send multiple requests rapidly
for i in {1..105}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/; done

# Expected: First 100 return 200, last 5 return 429
```

### HTTPS Test

```bash
# Start server with HTTPS
npm run start:https

# Test HTTPS connection (ignore self-signed certificate warning)
curl -k https://localhost:3443/

# Verify certificate
openssl s_client -connect localhost:3443 -showcerts
```

### CORS Test

```bash
# Test from allowed origin
curl -H "Origin: http://localhost:3000" -I http://localhost:3000/
# Should include: Access-Control-Allow-Origin: http://localhost:3000

# Test from blocked origin
curl -H "Origin: http://malicious-site.com" -I http://localhost:3000/
# Should NOT include Access-Control-Allow-Origin header
```

## Troubleshooting

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Find and kill the process using the port
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm start
```

### Certificate Errors

**Error**: `HTTPS server failed to start: ENOENT: no such file or directory`

**Solution**:
```bash
# Generate development certificates
npm run generate-certs

# Verify certificates exist
ls -la certs/
```

### CORS Errors

**Error**: `Not allowed by CORS policy`

**Solution**:
```bash
# Add your origin to the whitelist
ALLOWED_ORIGINS=http://localhost:3000,http://your-origin.com npm start
```

### Rate Limit False Positives

If legitimate users are hitting rate limits:

1. **Increase the limit**: Modify `max` in server.js (line 58)
2. **Increase the window**: Modify `windowMs` in server.js (line 57)
3. **Use Redis**: For multi-instance deployments, implement Redis-based rate limiting

## API Endpoints

### GET /

**Description**: Main endpoint returning "Hello, World!"

**Response**:
```
Hello, World!
```

**Status Code**: 200 OK

**Headers**: Includes all security headers

### GET /health

**Description**: Health check endpoint for monitoring and load balancers

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-13T10:30:00.000Z"
}
```

**Status Code**: 200 OK

## Dependencies

- **express** (^4.21.2): Web application framework
- **helmet** (^8.1.0): Security headers middleware
- **express-rate-limit** (^7.4.1): Rate limiting middleware
- **cors** (^2.8.5): CORS policy middleware

## Requirements

- Node.js >= 14.0.0 (recommended: v18 or v20)
- npm (comes with Node.js)

## License

MIT
