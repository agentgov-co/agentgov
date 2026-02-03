# Contributing to AgentGov

Thanks for your interest in contributing to AgentGov!

## Getting Started

1. Fork the repository
2. Clone your fork and install dependencies:

```bash
git clone https://github.com/<your-username>/agentgov.git
cd agentgov
pnpm install
```

3. Start the development environment:

```bash
docker-compose up -d
cp .env.example .env
pnpm db:push
pnpm dev
```

## Development Workflow

1. Create a feature branch from `main`:

```bash
git checkout -b feat/your-feature
```

2. Make your changes following the code style below
3. Run validation:

```bash
pnpm type-check && pnpm lint && pnpm test
```

4. Commit with a descriptive message:

```
feat(api): add trace filtering by date range
fix(web): resolve pagination reset on filter change
docs(sdk): add streaming example
```

5. Push and open a Pull Request against `main`

## Code Style

- TypeScript `strict` mode everywhere
- `interface` for objects, `type` for unions
- `unknown` over `any`
- Explicit return types on exported functions

### File Naming

```
*.route.ts      - API routes
*.service.ts    - Business logic
*.schema.ts     - Zod schemas
*.test.ts       - Tests (colocated with source)
use*.ts         - React hooks
```

## Project Structure

- `apps/api/` - Fastify backend
- `apps/web/` - Next.js frontend
- `packages/sdk/` - TypeScript SDK

## Guidelines

- Keep PRs focused on a single change
- Add tests for new functionality
- Don't introduce new dependencies without discussion
- SDK must stay under 100 lines (core)

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)
