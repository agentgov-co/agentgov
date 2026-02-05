# Plan: OpenAI Agents SDK Integration

**Author:** Claude
**Date:** 2025-02-05
**Status:** Draft

## Overview

Добавить поддержку [OpenAI Agents SDK](https://github.com/openai/openai-agents-js) через паттерн `TracingExporter` + `BatchTraceProcessor`.

### Почему этот подход

1. **Стандартный паттерн** — так делают [Keywords.ai](https://docs.keywordsai.co/integration/development-frameworks/tracing/openai-agents-sdk-js), [Langfuse](https://github.com/orgs/langfuse/discussions/9144), [ClickHouse](https://clickhouse.com/blog/tracing-openai-agents-clickstack)
2. **Батчинг из коробки** — `BatchTraceProcessor` уже реализован в `@openai/agents`
3. **Минимум кода** — только метод `export(items)`, ~50 строк
4. **Простота для пользователя** — 3 строки для подключения

### User Experience (Goal)

```typescript
import { BatchTraceProcessor, setTraceProcessors } from '@openai/agents';
import { AgentGovExporter } from '@agentgov/sdk/openai-agents';

setTraceProcessors([
  new BatchTraceProcessor(new AgentGovExporter({
    apiKey: "ag_live_xxx",
    projectId: "xxx"
  }))
]);

// Done — all agent traces go to AgentGov dashboard
```

---

## Technical Design

### Interface (from @openai/agents)

```typescript
// Source: https://openai.github.io/openai-agents-js/openai/agents/classes/consolespanexporter/
interface TracingExporter {
  export(items: (Trace | Span)[]): Promise<void>;
}

// Trace has: trace_id (format: trace_<32_alphanumeric>)
// Span has: trace_id, span_id, parent_id, name, started_at, ended_at, span_data
```

### AgentGov Mapping

| OpenAI Agents | AgentGov | Notes |
|---------------|----------|-------|
| `Trace` | `Trace` | Auto-create via externalId upsert |
| `Span` with `span_data.type = "agent"` | `Span` type=`AGENT_STEP` | |
| `Span` with `span_data.type = "generation"` | `Span` type=`LLM_CALL` | Extract model, tokens, cost |
| `Span` with `span_data.type = "function"` | `Span` type=`TOOL_CALL` | |
| `Span` with `span_data.type = "handoff"` | `Span` type=`AGENT_STEP` | metadata.handoff=true |
| `Span` with `span_data.type = "custom"` | `Span` type=`CUSTOM` | |

---

## Implementation Plan

### Phase 1: SDK Exporter (no API changes)

**Files to create:**
```
packages/sdk/src/exporters/
  └── openai-agents.ts        # ~60 lines
packages/sdk/src/exporters/
  └── openai-agents.test.ts   # ~80 lines
```

**Implementation:**

```typescript
// packages/sdk/src/exporters/openai-agents.ts
import type { TracingExporter, Trace, Span } from '@openai/agents';
import { FetchClient } from '../utils/fetch.js';
import type { SpanType } from '../types.js';

export interface AgentGovExporterConfig {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
  debug?: boolean;
}

export class AgentGovExporter implements TracingExporter {
  private client: FetchClient;
  private traceMap = new Map<string, string>(); // external_id → agentgov_id
  private debug: boolean;

  constructor(config: AgentGovExporterConfig) {
    this.debug = config.debug ?? false;
    this.client = new FetchClient({
      baseUrl: config.baseUrl ?? 'https://api.agentgov.co',
      apiKey: config.apiKey,
      projectId: config.projectId,
      debug: this.debug,
    });
  }

  async export(items: (Trace | Span)[]): Promise<void> {
    // 1. Group by trace_id
    const byTrace = this.groupByTrace(items);

    // 2. Process each trace group
    for (const [externalTraceId, group] of byTrace) {
      // 2a. Ensure trace exists in AgentGov
      let agTraceId = this.traceMap.get(externalTraceId);
      if (!agTraceId) {
        const traceItem = group.find(i => this.isTrace(i));
        const trace = await this.client.createTrace({
          name: traceItem?.name ?? 'Agent Run',
          metadata: { externalId: externalTraceId }
        });
        agTraceId = trace.id;
        this.traceMap.set(externalTraceId, agTraceId);
      }

      // 2b. Create spans
      const spans = group.filter(i => !this.isTrace(i)) as Span[];
      await Promise.all(spans.map(s => this.exportSpan(s, agTraceId!)));
    }
  }

  private async exportSpan(span: Span, traceId: string): Promise<void> {
    await this.client.createSpan({
      traceId,
      name: span.name,
      type: this.mapSpanType(span.span_data?.type),
      input: span.span_data?.input,
      metadata: {
        externalId: span.span_id,
        externalParentId: span.parent_id,
        ...span.span_data
      },
      model: span.span_data?.model,
      // ... extract tokens, cost from span_data.response
    });
  }

  private mapSpanType(type?: string): SpanType {
    switch (type) {
      case 'generation': return 'LLM_CALL';
      case 'function': return 'TOOL_CALL';
      case 'agent':
      case 'handoff': return 'AGENT_STEP';
      default: return 'CUSTOM';
    }
  }

  private isTrace(item: Trace | Span): item is Trace {
    return 'trace_id' in item && !('span_id' in item);
  }

  private groupByTrace(items: (Trace | Span)[]): Map<string, (Trace | Span)[]> {
    const map = new Map<string, (Trace | Span)[]>();
    for (const item of items) {
      const traceId = item.trace_id;
      if (!map.has(traceId)) map.set(traceId, []);
      map.get(traceId)!.push(item);
    }
    return map;
  }
}
```

**package.json changes:**

```json
{
  "peerDependencies": {
    "@openai/agents": ">=0.0.10"
  },
  "peerDependenciesMeta": {
    "@openai/agents": { "optional": true }
  },
  "exports": {
    ".": "./dist/index.js",
    "./openai-agents": "./dist/exporters/openai-agents.js"
  }
}
```

### Phase 2: API Enhancement (optional, for production)

**Если нужна идемпотентность (exporter restart safe):**

1. Add `externalId` to Trace schema in Prisma
2. Add upsert endpoint `POST /v1/traces` with `externalId` → upsert behavior
3. Update FetchClient with `upsertTrace` method

```prisma
model Trace {
  // ...existing fields
  externalId String? @unique  // OpenAI's trace_id
}
```

```typescript
// POST /v1/traces with externalId does upsert
const trace = await prisma.trace.upsert({
  where: { externalId: body.externalId },
  create: { ...body, projectId },
  update: { name: body.name } // minimal update
});
```

### Phase 3: Batch Endpoint (optimization)

**Когда будет 100+ spans/trace:**

```typescript
// POST /v1/spans/batch
sdk.post('/batch', async (request, reply) => {
  const { spans } = request.body; // SpanInput[]
  const created = await prisma.span.createMany({ data: spans });
  return { count: created.count };
});
```

---

## File Changes Summary

| File | Action | Lines |
|------|--------|-------|
| `packages/sdk/src/exporters/openai-agents.ts` | Create | ~60 |
| `packages/sdk/src/exporters/openai-agents.test.ts` | Create | ~80 |
| `packages/sdk/package.json` | Edit | +10 |
| `packages/sdk/src/index.ts` | Edit | +1 (re-export) |
| `packages/sdk/README.md` | Edit | +30 (docs section) |

**Total:** ~180 lines new code

---

## Testing Plan

1. **Unit tests** — mock FetchClient, verify mapping logic
2. **Integration test** — real agent run with ConsoleSpanExporter + AgentGovExporter side-by-side
3. **Manual QA** — run example agent, check dashboard

---

## Documentation

Add to `packages/sdk/README.md`:

```markdown
### OpenAI Agents SDK

\`\`\`typescript
import { Agent, run } from '@openai/agents';
import { BatchTraceProcessor, setTraceProcessors } from '@openai/agents';
import { AgentGovExporter } from '@agentgov/sdk/openai-agents';

// Setup tracing
setTraceProcessors([
  new BatchTraceProcessor(new AgentGovExporter({
    apiKey: process.env.AGENTGOV_API_KEY!,
    projectId: process.env.AGENTGOV_PROJECT_ID!,
  }))
]);

// Your agent code — traces automatically captured
const agent = new Agent({ name: 'MyAgent', ... });
await run(agent, 'Hello!');
\`\`\`
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| @openai/agents API changes | Pin peerDep version, add integration test |
| Memory leak in traceMap | Add LRU cache with 1000 entry limit |
| Concurrent exports race condition | traceMap is sync, Promise.all per trace group |

---

## Open Questions

1. **externalId in Phase 1?** — Можно хранить в metadata, но потеряем unique constraint
2. **Flush on shutdown?** — BatchTraceProcessor handles this, but document `getGlobalTraceProvider().forceFlush()`
3. **Voice agents support?** — Same exporter works, but Realtime API spans may need special handling

---

## Acceptance Criteria

- [ ] `AgentGovExporter` implements `TracingExporter` interface
- [ ] Works with `BatchTraceProcessor` from `@openai/agents`
- [ ] Unit tests pass
- [ ] Integration test with real agent works
- [ ] README documented
- [ ] `pnpm type-check && pnpm lint && pnpm test` passes
