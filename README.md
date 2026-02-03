# AgentGov

**AI Agent Governance Platform**

Monitor, secure, and control your AI agents with enterprise-grade governance. Built for teams that need visibility into agent operations, compliance tracking, and cost management.

---

## Features

- **Tracing Dashboard** — Real-time visibility into agent executions
- **Span Hierarchy** — Track LLM calls, tool executions, and agent steps
- **Cost Tracking** — Monitor token usage and costs per trace
- **Security** — API key authentication, data isolation per project
- **Compliance Ready** — Built with EU AI Act requirements in mind

---

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- pnpm
- Docker (for PostgreSQL & Redis)

### Setup

```bash
# Clone and install
git clone https://github.com/agentgov-co/agentgov.git
cd agentgov
pnpm install

# Start databases
docker-compose up -d

# Setup environment
cp .env.example .env

# Push database schema
pnpm db:push

# Start development
pnpm dev
```

The app will be available at:

- **Web Dashboard**: http://localhost:3000
- **API**: http://localhost:3001

---

## Project Structure

```
agentgov/
├── apps/
│   ├── api/                 # Fastify backend (port 3001)
│   │   ├── src/
│   │   │   ├── routes/      # REST endpoints
│   │   │   ├── services/    # Business logic
│   │   │   └── lib/         # Utilities
│   │   └── prisma/          # Database schema
│   │
│   └── web/                 # Next.js 16 frontend (port 3000)
│       └── src/
│           ├── app/         # App Router pages
│           ├── components/  # UI components (shadcn/ui)
│           └── lib/         # Hooks, utils
│
├── packages/
│   └── sdk/                 # @agentgov/sdk
│
└── docs/                    # Documentation
```

---

## SDK Usage

Install the SDK in your agent project:

```bash
npm install @agentgov/sdk
```

Initialize and trace your agent:

```typescript
import { AgentGov } from "@agentgov/sdk";

const gov = new AgentGov({
  apiKey: "your-api-key",
  projectId: "your-project-id",
});

// Start a trace
const trace = gov.startTrace({ name: "customer-support-agent" });

// Track an LLM call
const span = trace.startSpan({
  name: "llm_call",
  type: "LLM_CALL",
  model: "gpt-4",
});

// ... your LLM call here ...

span.end({
  output: response,
  promptTokens: 150,
  outputTokens: 50,
  cost: 0.0045,
});

// End the trace
trace.end({ output: finalResult });
```

---

## Scripts

```bash
# Development
pnpm dev              # Start all services
pnpm build            # Build everything
pnpm test             # Run tests
pnpm lint             # Lint code
pnpm type-check       # TypeScript check

# Database
pnpm db:push          # Push Prisma schema
pnpm db:studio        # Open Prisma Studio
pnpm db:migrate       # Run migrations

# Single package
pnpm --filter api dev    # API only
pnpm --filter web dev    # Web only
pnpm --filter sdk build  # SDK only
```

---

## Environment Variables

Create a `.env` file in the root:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agentgov"
REDIS_URL="redis://localhost:6379"

# API
API_PORT=3001
API_URL="http://localhost:3001"

# Web
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | Next.js 16, React 19, TailwindCSS, shadcn/ui |
| Backend  | Fastify, Zod                                 |
| Database | PostgreSQL, Prisma ORM                       |
| Cache    | Redis                                        |
| SDK      | TypeScript (zero dependencies)               |
| Auth     | API keys (hashed), NextAuth.js               |

---

## Data Model

### Core Entities

- **Project** — Tenant workspace with API key
- **Trace** — Complete agent execution (start to finish)
- **Span** — Single operation within a trace

### Span Types

| Type         | Description                           |
| ------------ | ------------------------------------- |
| `LLM_CALL`   | Call to LLM (OpenAI, Anthropic, etc.) |
| `TOOL_CALL`  | Tool/function execution               |
| `AGENT_STEP` | High-level agent step                 |
| `RETRIEVAL`  | RAG retrieval                         |
| `EMBEDDING`  | Embedding generation                  |
| `CUSTOM`     | Custom span type                      |

---

## API Endpoints

```
POST   /v1/projects              # Create project
GET    /v1/projects/:id          # Get project
GET    /v1/projects/:id/traces   # List traces

POST   /v1/traces                # Create trace
GET    /v1/traces/:id            # Get trace
PATCH  /v1/traces/:id            # Update trace

POST   /v1/spans                 # Create span
PATCH  /v1/spans/:id             # Update span
```

All endpoints require `Authorization: Bearer <api-key>` header.

---

## Contributing

1. Create a feature branch from `main`
2. Make changes following code style guidelines
3. Run `pnpm type-check && pnpm lint && pnpm test`
4. Submit a pull request

---

## License

MIT
