# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please follow these steps:

1. **Do Not** create a public GitHub issue for security vulnerabilities
2. Send an email to the repository maintainers with:
   - A description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Timeline**: Depends on severity (Critical: 24-72 hours, High: 1-2 weeks, Medium/Low: Next release)

## Security Best Practices Implemented

### Authentication & Authorization

- **Password Hashing**: bcrypt with salt rounds for secure password storage
- **Token-Based Auth**: Session tokens for API authentication
- **Role-Based Access Control (RBAC)**: Server-enforced permissions for customer, agent, and admin roles
- **Phone Verification**: 6-digit code verification for customer accounts
- **Rate Limiting**: Protection against brute force attacks on authentication endpoints

### Data Protection

- **SQL Injection Prevention**: All database queries use parameterized statements
- **XSS Prevention**: HTML escaping with `escapeHtml()` function in all frontend files
- **Input Validation**: Server-side validation on all POST/PUT requests
- **CORS Configuration**: Restricted to known frontend origins

### Database Security

- **Database Transactions**: Atomic operations for critical multi-step processes
- **Row-Level Locking**: Prevention of race conditions in queue management
- **Soft Delete Pattern**: Data preservation for audit trails (properties and users)
- **Foreign Key Constraints**: Referential integrity enforcement

### API Security

- **Standardized Error Responses**: No information leakage in error messages
- **Authentication Middleware**: All sensitive routes protected
- **Role Verification**: Additional checks for admin/agent-only operations

## Security Recommendations for Production

### Required Before Deployment

1. **HTTPS Configuration**
   - Use TLS 1.2 or higher
   - Obtain SSL certificate from trusted CA (e.g., Let's Encrypt)
   - Enable HSTS headers

2. **Environment Variables**
   - Use strong JWT secret (32+ characters)
   - Store secrets in a secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Never commit `.env` files to version control

3. **Database Security**
   - Create dedicated database user with minimal privileges
   - Enable MySQL SSL connections
   - Regular security patches

4. **Change Default Credentials**
   - Replace all demo accounts before production
   - Enforce strong password policy

### Recommended Additional Measures

1. **Web Application Firewall (WAF)**
   - CloudFlare, AWS WAF, or similar
   - Protection against common attacks (SQL injection, XSS, DDoS)

2. **Security Headers**
   ```nginx
   add_header X-Frame-Options "SAMEORIGIN" always;
   add_header X-Content-Type-Options "nosniff" always;
   add_header X-XSS-Protection "1; mode=block" always;
   add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
   ```

3. **Logging & Monitoring**
   - Centralized logging (ELK Stack, CloudWatch)
   - Security event alerting
   - Regular log analysis

4. **Regular Security Audits**
   - Dependency vulnerability scanning (npm audit)
   - Penetration testing
   - Code security reviews

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| SMS codes logged to console | Demo only, not secure | Integrate Twilio/SMS gateway for production |
| Base64 tokens | Not cryptographically secure | Migrate to signed JWTs |
| File storage on disk | Not scalable | Use S3/cloud storage |
| No CSRF tokens | Partial protection | Implement CSRF tokens for forms |

## Security Contact

For security-related inquiries, please contact the repository maintainers through GitHub.

## Changelog

### v1.2.0 Security Updates
- Added rate limiting for authentication endpoints
- Implemented database transactions with row locking for queue promotion
- Enhanced XSS prevention with escapeHtml() across all frontends
- Added soft delete pattern for data preservation
- Standardized error responses to prevent information leakage

### v1.1.0 Security Updates
- Initial RBAC implementation
- Password hashing with bcrypt
- Parameterized SQL queries
