# Security Policy

We take the security of **cohive** very seriously. Below you will find details on our security architecture, best practices, and how to report vulnerabilities responsibly.

---

## 🛡️ Built-in Security Architecture

**cohive** is designed with privacy and security at its core:

- **Strong Password Hashing**: Uses Web Crypto API's **PBKDF2 with 600,000 iterations** (OWASP 2024 recommended standard) and cryptographically secure salts.
- **Timing Attack Prevention**: Uses constant-time string comparisons (`timingSafeEqual`) for password hash verification.
- **JWT & Session Security**: HMAC-SHA256 signed JSON Web Tokens (JWT) with automatic Secret generation, HttpOnly / SameSite Cookie handling, and strict token expiration.
- **XSS & Content Sanitization**: Strict HTML escaping on user inputs and Markdown rendering, avoiding dangerous URL schemes (`javascript:`, `data:`, `vbscript:`).
- **IDOR & Authorization Control**: Middleware-enforced JWT signature verification for all API routes, preventing header/query spoofing.
- **Data Encryption at Rest**: Sensitive configurations (such as SMTP passwords) are encrypted using AES-GCM-256 before storage in D1 databases.
- **Zero-Config CORS & Origin Protection**: Automatically restricts API cross-origin access to the deployed self-origin and trusted origins upon one-click deployment.
- **Strict HTTP Security Headers**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`, `X-XSS-Protection`, and `Referrer-Policy` across all API responses.
- **Unhandled Error Masking**: Sanitizes 500 error responses to prevent internal database schema or stack trace information leakage.
- **Rate Limiting & Abuse Prevention**: Rate-limits sensitive operations (login, registration, password changes, and message posts) at the edge.

---

## 🔒 Reporting Security Issues

If you discover a security vulnerability or potential threat in this project, please report it to us responsibly.

### How to Report

Please report security issues using **GitHub's Private Vulnerability Reporting**:

1. Go to the repository's **Security** tab on GitHub.
2. Click **Report a vulnerability** to submit a private report directly to the maintainers.

If Private Vulnerability Reporting is unavailable in your view, you may open a [GitHub Issue](https://github.com/cohive-tms/cohive-cloudflare/issues) requesting a private disclosure channel without exposing vulnerability specifics.

### Preferred Response Timeline

- **Acknowledgement**: Within 48 hours.
- **Assessment & Status Updates**: Within 7 business days.
- **Fix Release**: As soon as possible depending on severity.

Thank you for helping keep **cohive** secure for everyone!
