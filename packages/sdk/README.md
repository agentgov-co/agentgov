# @agentgov/sdk

[![npm version](https://img.shields.io/npm/v/@agentgov/sdk)](https://www.npmjs.com/package/@agentgov/sdk)
[![license](https://img.shields.io/npm/l/@agentgov/sdk)](https://github.com/agentgov-co/agentgov/blob/main/LICENSE)

Observability SDK for AI agents. Trace LLM calls, tool usage, and agent steps with minimal code changes.

Supports OpenAI, OpenAI Agents SDK, Vercel AI SDK, streaming, tool calls, and cost tracking.

## Installation

```bash
npm install @agentgov/sdk
```

> Requires Node.js >= 18

## Quick Start

### OpenAI

```typescript
import { AgentGov } from "@agentgov/sdk";
import OpenAI from "openai";

const ag = new AgentGov({
  apiKey: process.env.AGENTGOV_API_KEY!,
  projectId: process.env.AGENTGOV_PROJECT_ID!,
});

const openai = ag.wrapOpenAI(new OpenAI());

// All calls are automatically traced — including streaming and tool calls
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Vercel AI SDK

```typescript
import { AgentGov } from "@agentgov/sdk";
import { generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const ag = new AgentGov({
  apiKey: process.env.AGENTGOV_API_KEY!,
  projectId: process.env.AGENTGOV_PROJECT_ID!,
});

const tracedGenerateText = ag.wrapGenerateText(generateText);
const tracedStreamText = ag.wrapStreamText(streamText);

const { text } = await tracedGenerateText({
  model: openai("gpt-4o"),
  prompt: "Hello!",
});
```

### OpenAI Agents SDK

Native integration with [@openai/agents](https://github.com/openai/openai-agents-js):

```typescript
import { Agent, run } from "@openai/agents";
import { BatchTraceProcessor, setTraceProcessors } from "@openai/agents";
import { AgentGovExporter } from "@agentgov/sdk/openai-agents";

// Setup tracing (do this once at app startup)
setTraceProcessors([
  new BatchTraceProcessor(
    new AgentGovExporter({
      apiKey: process.env.AGENTGOV_API_KEY!,
      projectId: process.env.AGENTGOV_PROJECT_ID!,
    })
  ),
]);

// Your agent code — all traces automatically captured
const agent = new Agent({
  name: "WeatherAgent",
  model: "gpt-4o",
  instructions: "You help users with weather information.",
  tools: [getWeatherTool],
});

await run(agent, "What's the weather in Tokyo?");
```

**Supported span types:**

| OpenAI Agents Type | AgentGov Type | Description |
| --- | --- | --- |
| `generation` | `LLM_CALL` | LLM API calls with model, tokens, cost |
| `function` | `TOOL_CALL` | Tool/function executions |
| `agent` | `AGENT_STEP` | Agent lifecycle spans |
| `handoff` | `AGENT_STEP` | Agent-to-agent handoffs |
| `guardrail` | `CUSTOM` | Guardrail checks |
| `response` | `LLM_CALL` | Response aggregation |
| `transcription`, `speech` | `LLM_CALL` | Voice agent operations |
| `custom` | `CUSTOM` | Custom spans |

**Configuration options:**

```typescript
new AgentGovExporter({
  apiKey: string,           // Required. API key from dashboard
  projectId: string,        // Required. Project ID
  baseUrl: string,          // Default: "https://api.agentgov.co"
  debug: boolean,           // Default: false
  maxCacheSize: number,     // Default: 1000 (LRU cache for trace IDs)
  cacheTtl: number,         // Default: 3600000 (1 hour)
  maxRetries: number,       // Default: 3
  timeout: number,          // Default: 30000 (ms)
  batchThreshold: number,   // Default: 5. Min spans to use batch endpoint. Set to 0 to disable.
  onError: (error, ctx) => void, // Optional error callback
});
```

**Performance tuning:**

For agents with many spans (100+ per trace), the exporter automatically batches span creation:

```typescript
new AgentGovExporter({
  apiKey: process.env.AGENTGOV_API_KEY!,
  projectId: process.env.AGENTGOV_PROJECT_ID!,
  batchThreshold: 10,  // Use batch endpoint when 10+ spans need export
});
```

| Scenario | Recommended `batchThreshold` |
| --- | --- |
| Simple agents (< 10 spans) | `0` (disabled) |
| Medium complexity (10-50 spans) | `5` (default) |
| Complex multi-agent workflows | `10-20` |

The batch endpoint reduces API calls by up to 20x and includes automatic fallback to individual exports on failure.

### Manual Tracing

```typescript
const result = await ag.withTrace({ name: "My Agent Pipeline" }, async () => {
  const docs = await ag.withSpan(
    { name: "Retrieve Documents", type: "RETRIEVAL" },
    async () => fetchDocs()
  );

  const response = await ag.withSpan(
    { name: "Generate Response", type: "LLM_CALL", model: "gpt-4o" },
    async () => generateResponse(docs)
  );

  return response;
});
```

## Authentication

Get your API key from the AgentGov dashboard (**Settings > API Keys**).

Keys use the format `ag_live_xxx` (production) or `ag_test_xxx` (testing).

```typescript
const ag = new AgentGov({
  apiKey: "ag_live_xxxxxxxxxxxx",
  projectId: "your-project-id",
});
```

## Configuration

```typescript
const ag = new AgentGov({
  apiKey: string,           // Required. API key from dashboard
  projectId: string,        // Required. Project ID
  baseUrl: string,          // Default: "https://api.agentgov.co"
  debug: boolean,           // Default: false
  flushInterval: number,    // Default: 5000 (ms)
  batchSize: number,        // Default: 10
  maxRetries: number,       // Default: 3
  retryDelay: number,       // Default: 1000 (ms)
  timeout: number,          // Default: 30000 (ms)
  onError: (error, ctx) => void, // Optional error callback
});
```

## Wrapper Options

Both OpenAI and Vercel AI wrappers accept options:

```typescript
const openai = ag.wrapOpenAI(new OpenAI(), {
  traceNamePrefix: "my-agent",
  autoTrace: true,
  captureInput: true,
  captureOutput: true,
  traceToolCalls: true,
});
```

## Batching

For high-throughput scenarios:

```typescript
const ag = new AgentGov({
  apiKey: "ag_xxx",
  projectId: "xxx",
  batchSize: 10,
  flushInterval: 5000,
});

ag.queueTrace({ name: "Batch Trace" });
ag.queueSpan({ traceId: "...", name: "Batch Span", type: "CUSTOM" });

await ag.flush();     // Force flush
await ag.shutdown();  // Flush and cleanup
```

## Error Handling

Built-in retry with exponential backoff. Retries on `429`, `408`, and `5xx`. No retries on `400`, `401`, `403`, `404`.

```typescript
import { AgentGov, AgentGovAPIError } from "@agentgov/sdk";

try {
  const trace = await ag.trace({ name: "My Trace" });
} catch (error) {
  if (error instanceof AgentGovAPIError) {
    console.log(error.statusCode, error.retryable);
  }
}
```

## Span Types

| Type         | Description               |
| ------------ | ------------------------- |
| `LLM_CALL`  | LLM API call              |
| `TOOL_CALL`  | Tool/function execution   |
| `AGENT_STEP` | High-level agent step     |
| `RETRIEVAL`  | RAG document retrieval    |
| `EMBEDDING`  | Embedding generation      |
| `CUSTOM`     | Custom span               |

## Cost Estimation

Built-in pricing for OpenAI (GPT-5, GPT-4, o-series) and Anthropic (Claude 4, 3.5, 3) models:

```typescript
import { estimateCost } from "@agentgov/sdk";

estimateCost("gpt-4o", 1000, 500); // 0.0075 (USD)
```

## API Reference

| Method | Description |
| --- | --- |
| `wrapOpenAI(client, opts?)` | Auto-trace OpenAI calls |
| `wrapGenerateText(fn, opts?)` | Wrap Vercel AI `generateText` |
| `wrapStreamText(fn, opts?)` | Wrap Vercel AI `streamText` |
| `wrapGenerateObject(fn, opts?)` | Wrap Vercel AI `generateObject` |
| `wrapEmbed(fn, opts?)` | Wrap Vercel AI `embed` |
| `wrapEmbedMany(fn, opts?)` | Wrap Vercel AI `embedMany` |
| `trace(input?)` | Create a trace |
| `endTrace(id, update?)` | End a trace |
| `span(input)` | Create a span |
| `endSpan(id, update?)` | End a span |
| `withTrace(input, fn)` | Run function within trace context |
| `withSpan(input, fn)` | Run function within span context |
| `queueTrace(input)` | Queue trace (batched) |
| `queueSpan(input)` | Queue span (batched) |
| `flush()` | Force flush queued items |
| `shutdown()` | Flush and cleanup |
| `getContext()` | Get current trace context |
| `setContext(ctx)` | Set trace context |
| `getTrace(id)` | Fetch trace by ID |
| `getSpan(id)` | Fetch span by ID |

## TypeScript

```typescript
import type {
  AgentGovConfig,
  Trace, TraceInput, TraceStatus, TraceContext,
  Span, SpanInput, SpanUpdate, SpanStatus, SpanType,
  WrapOpenAIOptions, WrapVercelAIOptions,
} from "@agentgov/sdk";

// OpenAI Agents SDK types
import type {
  AgentGovExporter,
  AgentGovExporterConfig,
  TracingExporter,
  ExportErrorContext,
} from "@agentgov/sdk/openai-agents";
```

## Examples

See the [examples](https://github.com/agentgov-co/agentgov/tree/main/examples) directory.

## License

MIT
