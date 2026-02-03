# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AgentGov, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@agentgov.co**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Security Best Practices

When self-hosting AgentGov:

- Never commit `.env` files with real credentials
- Rotate `BETTER_AUTH_SECRET` immediately if exposed
- Use unique, strong passwords for PostgreSQL and Redis in production
- Enable TLS for all database connections in production
- Keep dependencies up to date (`pnpm audit`)
