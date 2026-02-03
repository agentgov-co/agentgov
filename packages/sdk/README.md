# @agentgov/sdk

Official SDK for AgentGov — AI Agent Governance Platform.

Automatically trace your AI agent operations with minimal code changes. Supports OpenAI, Vercel AI SDK, streaming, tool calls, and more.

## Features

- **OpenAI Integration** — Automatic tracing with `wrapOpenAI()`
- **Vercel AI SDK** — Support for `generateText`, `streamText`, `generateObject`, `embed`
- **Streaming Support** — Full tracking of streaming responses
- **Tool Calls** — Automatic span creation for tool/function calls
- **Cost Estimation** — Built-in pricing for common models
- **Batching** — High-throughput mode with `queueTrace()` / `queueSpan()`
- **Context Management** — `withTrace()` / `withSpan()` helpers

## Installation

```bash
npm install @agentgov/sdk
# or
pnpm add @agentgov/sdk
```

## Authentication

The SDK uses API keys for authentication. Get your API key from the AgentGov dashboard:

1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. Copy the key (it's only shown once!)

API keys have the format `ag_live_xxxxxxxxxxxx` (production) or `ag_test_xxxxxxxxxxxx` (testing).

```typescript
import { AgentGov } from "@agentgov/sdk";

const ag = new AgentGov({
  apiKey: process.env.AGENTGOV_API_KEY!, // ag_live_xxx or ag_test_xxx
  projectId: process.env.AGENTGOV_PROJECT_ID!,
});
```

### API Key Scopes

API keys can be scoped to:
- **All projects** — Access all projects in your organization
- **Specific project** — Access only the specified project

### Error Handling for Auth

```typescript
import { AgentGov, AgentGovAPIError } from "@agentgov/sdk";

try {
  const trace = await ag.trace({ name: "My Trace" });
} catch (error) {
  if (error instanceof AgentGovAPIError) {
    if (error.statusCode === 401) {
      console.error("Invalid API key");
    } else if (error.statusCode === 403) {
      console.error("Access denied - check API key permissions");
    } else if (error.statusCode === 429) {
      console.error("Rate limit exceeded");
    }
  }
}
```

## Quick Start

### OpenAI Integration

```typescript
import { AgentGov } from "@agentgov/sdk";
import OpenAI from "openai";

const ag = new AgentGov({
  apiKey: process.env.AGENTGOV_API_KEY!,
  projectId: process.env.AGENTGOV_PROJECT_ID!,
});

// Wrap your OpenAI client
const openai = ag.wrapOpenAI(new OpenAI());

// All calls are automatically traced - including streaming!
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

// Streaming also works
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a poem" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

### Vercel AI SDK Integration

```typescript
import { AgentGov } from "@agentgov/sdk";
import { generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const ag = new AgentGov({
  apiKey: process.env.AGENTGOV_API_KEY!,
  projectId: process.env.AGENTGOV_PROJECT_ID!,
});

// Wrap Vercel AI SDK functions
const tracedGenerateText = ag.wrapGenerateText(generateText);
const tracedStreamText = ag.wrapStreamText(streamText);

// Use them like normal
const { text } = await tracedGenerateText({
  model: openai("gpt-4o"),
  prompt: "Hello!",
});

// Streaming
const { textStream } = await tracedStreamText({
  model: openai("gpt-4o"),
  prompt: "Write a story",
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

### Manual Tracing

```typescript
import { AgentGov } from "@agentgov/sdk";

const ag = new AgentGov({
  apiKey: "ag_xxx",
  projectId: "your-project-id",
});

// Using withTrace helper (recommended)
const result = await ag.withTrace({ name: "My Agent Pipeline" }, async () => {
  // Nested spans
  const docs = await ag.withSpan(
    { name: "Retrieve Documents", type: "RETRIEVAL" },
    async () => {
      return ["doc1", "doc2"];
    }
  );

  const response = await ag.withSpan(
    { name: "Generate Response", type: "LLM_CALL", model: "gpt-4o" },
    async (span) => {
      // Update span with metrics
      await ag.endSpan(span.id, {
        promptTokens: 150,
        outputTokens: 50,
        cost: 0.01,
      });
      return { content: "Hello!" };
    }
  );

  return response;
});
```

### High-Throughput Batching

```typescript
const ag = new AgentGov({
  apiKey: "ag_xxx",
  projectId: "xxx",
  batchSize: 10, // Flush after 10 items
  flushInterval: 5000, // Or after 5 seconds
});

// Queue items (don't await immediately)
const tracePromise = ag.queueTrace({ name: "Batch Trace" });
const spanPromise = ag.queueSpan({
  traceId: "...",
  name: "Batch Span",
  type: "CUSTOM",
});

// Force flush when needed
await ag.flush();

// Or shutdown gracefully
await ag.shutdown();
```

## Configuration

```typescript
interface AgentGovConfig {
  /** API key from AgentGov dashboard (ag_xxx) */
  apiKey: string;

  /** Project ID */
  projectId: string;

  /** API base URL (default: https://api.agentgov.co) */
  baseUrl?: string;

  /** Enable debug logging */
  debug?: boolean;

  /** Flush interval in ms (default: 5000) */
  flushInterval?: number;

  /** Max batch size before auto-flush (default: 10) */
  batchSize?: number;

  /** Max retry attempts for failed API requests (default: 3) */
  maxRetries?: number;

  /** Base delay in ms for exponential backoff (default: 1000) */
  retryDelay?: number;

  /** Request timeout in ms (default: 30000) */
  timeout?: number;

  /** Callback for batch flush errors (optional) */
  onError?: (error: Error, context: { operation: string; itemCount?: number }) => void;
}
```

### Error Callback

Handle batch flush errors with the `onError` callback:

```typescript
const ag = new AgentGov({
  apiKey: "ag_xxx",
  projectId: "xxx",
  onError: (error, context) => {
    console.error(`[AgentGov] ${context.operation} failed:`, error.message);
    // Send to your error tracking service
    Sentry.captureException(error, { extra: context });
  },
});
```

By default, errors during batch flush are:
- Logged to console in `debug` mode
- Silently dropped in production (to not affect your app)

## Error Handling

The SDK includes built-in retry logic with exponential backoff:

```typescript
import { AgentGov, AgentGovAPIError } from "@agentgov/sdk";

const ag = new AgentGov({
  apiKey: "ag_xxx",
  projectId: "xxx",
  maxRetries: 3, // Retry up to 3 times
  retryDelay: 1000, // Start with 1s delay
  timeout: 30000, // 30s request timeout
});

try {
  const trace = await ag.trace({ name: "My Trace" });
} catch (error) {
  if (error instanceof AgentGovAPIError) {
    console.log(`Status: ${error.statusCode}`);
    console.log(`Retryable: ${error.retryable}`);
  }
}
```

**Automatic retries for:**

- `429` - Rate limited (respects `Retry-After` header)
- `408` - Request timeout
- `5xx` - Server errors

**No retries for:**

- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found

## Wrapper Options

### OpenAI Options

```typescript
const openai = ag.wrapOpenAI(new OpenAI(), {
  traceNamePrefix: "my-agent", // Custom trace name prefix
  autoTrace: true, // Auto-create trace for each call
  captureInput: true, // Include prompts in trace
  captureOutput: true, // Include responses in trace
  traceToolCalls: true, // Create spans for tool calls
});
```

### Vercel AI Options

```typescript
const tracedFn = ag.wrapGenerateText(generateText, {
  traceNamePrefix: "vercel-ai",
  autoTrace: true,
  captureInput: true,
  captureOutput: true,
  traceToolCalls: true,
});
```

## Span Types

| Type         | Description                           |
| ------------ | ------------------------------------- |
| `LLM_CALL`   | Call to LLM (OpenAI, Anthropic, etc.) |
| `TOOL_CALL`  | Tool/function execution               |
| `AGENT_STEP` | High-level agent step                 |
| `RETRIEVAL`  | RAG retrieval                         |
| `EMBEDDING`  | Embedding generation                  |
| `CUSTOM`     | Custom span type                      |

## Cost Estimation

Built-in pricing for common models:

```typescript
import { estimateCost } from "@agentgov/sdk";

const cost = estimateCost("gpt-4o", 1000, 500);
// Returns: 0.0075 (USD)
```

**Supported models (January 2026):**

- OpenAI GPT-5: gpt-5.2, gpt-5.2-pro, gpt-5
- OpenAI GPT-4: gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-4o-mini
- OpenAI o-Series: o4-mini, o3-pro, o3, o3-mini, o1, o1-mini
- OpenAI Legacy: gpt-4-turbo, gpt-4, gpt-3.5-turbo
- Anthropic: claude-sonnet-4, claude-3.5-sonnet, claude-3.5-haiku, claude-3-opus, claude-3-sonnet, claude-3-haiku
- Embeddings: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002

## API Reference

### AgentGov Class

| Method                    | Description                              |
| ------------------------- | ---------------------------------------- |
| `wrapOpenAI(client)`      | Wrap OpenAI client for auto-tracing      |
| `wrapGenerateText(fn)`    | Wrap Vercel AI generateText              |
| `wrapStreamText(fn)`      | Wrap Vercel AI streamText                |
| `wrapGenerateObject(fn)`  | Wrap Vercel AI generateObject            |
| `wrapEmbed(fn)`           | Wrap Vercel AI embed                     |
| `wrapEmbedMany(fn)`       | Wrap Vercel AI embedMany                 |
| `trace(input)`            | Create a new trace                       |
| `endTrace(id, update)`    | End a trace                              |
| `span(input)`             | Create a span                            |
| `endSpan(id, update)`     | End a span                               |
| `withTrace(input, fn)`    | Execute function within trace context    |
| `withSpan(input, fn)`     | Execute function within span context     |
| `queueTrace(input)`       | Queue trace creation (batched)           |
| `queueSpan(input)`        | Queue span creation (batched)            |
| `flush()`                 | Force flush queued items                 |
| `shutdown()`              | Flush and cleanup                        |
| `getContext()`            | Get current trace context                |
| `setContext(ctx)`         | Set trace context (distributed tracing)  |
| `getTrace(id)`            | Fetch trace by ID                        |
| `getSpan(id)`             | Fetch span by ID                         |

## TypeScript

Full TypeScript support:

```typescript
import type {
  AgentGovConfig,
  Trace,
  Span,
  SpanType,
  TraceContext,
  WrapOpenAIOptions,
  WrapVercelAIOptions,
} from "@agentgov/sdk";
```

## Examples

See the [examples](../../examples) directory:

- `openai-example.ts` — Basic OpenAI integration
- `streaming-example.ts` — Streaming responses
- `vercel-ai-example.ts` — Vercel AI SDK integration
- `manual-tracing.ts` — Manual span creation

## Documentation

[docs.agentgov.co](https://docs.agentgov.co)

## License

MIT
