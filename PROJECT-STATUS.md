# AgentGov Project Status — Для Review

## 🎯 Цель проекта

**AgentGov** — compliance-native AI observability platform.

Уникальность: **Единственная платформа с EU AI Act compliance как core feature**, а не afterthought.

## 📅 Контекст (январь 2026)

| Событие | Дата | Значимость |
|---------|------|------------|
| Langfuse → ClickHouse | 16 янв 2026 | Лидер рынка потерял независимость |
| **Сейчас** | 24 янв 2026 | 7 месяцев до deadline |
| EU AI Act enforcement | 2 авг 2026 | High-risk AI должны соответствовать |

## ✅ Что сделано

### Бизнес-документация
- [x] Бизнес-план v2.0 с финансами (`agentgov-business-plan-2026-v2.md`)
- [x] Анализ конкурентов (`competitor-analysis-2026.md`)
- [x] Исследование рынка LLM observability

### Технические спецификации (ТЗ)
- [x] **ТЗ #1**: Monorepo setup (Next.js 16 + Fastify 5 + pnpm workspaces)
- [x] **ТЗ #2**: Database schema (Prisma 6) + REST API endpoints
- [x] **ТЗ #3**: TypeScript SDK + OpenAI wrapper
- [x] **ТЗ #4**: Frontend dashboard + TanStack Query + shadcn/ui
- [x] **ТЗ #5**: WebSocket real-time updates

### Что НЕ сделано
- [ ] Код не написан (только спецификации)
- [ ] Auth (Clerk / Auth.js)
- [ ] Billing (Stripe)
- [ ] Compliance features (EU AI Act wizard)
- [ ] Deployment (AWS)

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Apps                            │
│    OpenAI / Anthropic / Custom LLM                          │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │   @agentgov/sdk     │                        │
│              │   (TypeScript)      │                        │
│              └──────────┬──────────┘                        │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTPS
                ┌─────────▼─────────┐
                │   Fastify API     │ :4000
                │   ├─ /v1/traces   │
                │   ├─ /v1/spans    │
                │   └─ /ws          │
                └─────────┬─────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
   ┌─────▼─────┐   ┌──────▼─────┐   ┌─────▼─────┐
   │ PostgreSQL│   │   Redis    │   │    S3     │
   │  (Prisma) │   │  (Cache)   │   │  (Logs)   │
   └───────────┘   └────────────┘   └───────────┘
```

## 📊 Database Schema

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  apiKey    String   @unique
  traces    Trace[]
}

model Trace {
  id        String   @id @default(cuid())
  projectId String
  name      String
  status    String   // "running" | "completed" | "error"
  startTime DateTime
  endTime   DateTime?
  metadata  Json?
  spans     Span[]
}

model Span {
  id           String   @id @default(cuid())
  traceId      String
  parentSpanId String?
  name         String
  type         String   // "llm" | "tool" | "chain" | "agent"
  status       String
  input        Json?
  output       Json?
  model        String?
  tokenUsage   Json?    // { prompt, completion, total }
  cost         Float?
}
```

## 🛠 Tech Stack

| Layer | Choice | Почему |
|-------|--------|--------|
| Frontend | Next.js 16 + React 19 | Latest App Router, RSC |
| UI | shadcn/ui + Tailwind | Developer-friendly, accessible |
| State | TanStack Query 5 | Cache, real-time, optimistic updates |
| Backend | Fastify 5 | Fastest Node.js framework |
| ORM | Prisma 6 | Type-safe, great DX |
| DB | PostgreSQL 16 | Reliable, JSON support |
| Real-time | @fastify/websocket | Native Fastify integration |
| SDK | TypeScript | Zero deps, type-safe |

## 🤔 Вопросы для Review

### 1. Последовательность ТЗ
Правильный ли порядок?
```
ТЗ #1 (Monorepo) → ТЗ #2 (DB/API) → ТЗ #3 (SDK) → ТЗ #4 (Frontend) → ТЗ #5 (WebSocket)
```

### 2. Database Schema
- Достаточно ли для MVP?
- Нужен ли User model для auth?
- Как хранить API keys (hashed)?

### 3. Tech Stack 2026
- Next.js 16 vs 15? (16 пока не вышел)
- Fastify 5 vs Express?
- Prisma 6 vs Drizzle?

### 4. Масштабирование
- WebSocket для 1000+ клиентов?
- Нужен ли Redis pub/sub для horizontal scaling?
- ClickHouse для traces вместо PostgreSQL?

### 5. MVP Scope
Что убрать из MVP?
- Real-time WebSocket (можно polling?)
- OpenAI wrapper (пусть юзеры сами?)

### 6. Следующий шаг
Что делать первым?
- Писать код по ТЗ #1?
- Упростить scope?
- Сначала landing page?

## 📁 Файлы для изучения

```
/home/claude/
├── agentgov-business-plan-2026-v2.md   # Бизнес-план
├── competitor-analysis-2026.md          # Конкуренты
├── tz-01-project-init-v2.md            # Monorepo setup
├── tz-02-database-api.md               # DB + API
├── tz-03-sdk-integration.md            # SDK
├── tz-04-frontend-dashboard.md         # Frontend
├── tz-05-realtime-websocket.md         # WebSocket
└── CLAUDE.md                           # Project context
```

## 💰 Business Context

| Metric | Target |
|--------|--------|
| Seed Round | $2.5M |
| Year 1 ARR | $1.5M |
| Break-even | 18-20 months |
| First 10 customers | Q1 2026 |

### Pricing
- Free: $0 (10K traces/mo)
- Starter: $99/mo (100K traces)
- Pro: $299/mo (500K + compliance)
- Enterprise: Custom

### Конкуренты
| | EU AI Act | Pricing |
|-|-----------|---------|
| Langfuse | ❌ | $0-59 |
| LangSmith | ❌ | $39/user |
| Datadog | ⚠️ | $50K+ |
| **AgentGov** | **✅ Core** | **$99-299** |

---

**Жду feedback по:**
1. Архитектуре
2. Tech stack
3. MVP scope
4. Следующим шагам
