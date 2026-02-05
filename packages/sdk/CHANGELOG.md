# Changelog

All notable changes to `@agentgov/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **OpenAI Agents SDK Integration** - Native support for [@openai/agents](https://github.com/openai/openai-agents-js)
  - `AgentGovExporter` class implementing `TracingExporter` interface
  - Works with `BatchTraceProcessor` for efficient batching
  - Automatic mapping of all span types (generation, function, agent, handoff, guardrail, voice)
  - LRU cache with TTL for trace/span ID mapping (prevents memory leaks)
  - Graceful error handling - individual failures don't break the batch
  - AbortSignal support for graceful shutdown
  - Token and cost extraction from generation spans
  - Debug mode with detailed logging

### Usage

```typescript
import { BatchTraceProcessor, setTraceProcessors } from '@openai/agents'
import { AgentGovExporter } from '@agentgov/sdk/openai-agents'

setTraceProcessors([
  new BatchTraceProcessor(new AgentGovExporter({
    apiKey: process.env.AGENTGOV_API_KEY!,
    projectId: process.env.AGENTGOV_PROJECT_ID!,
  }))
])
```

## [0.1.2] - 2025-01-23

### Added

- Vercel AI SDK support (`wrapGenerateText`, `wrapStreamText`, `wrapGenerateObject`, `wrapEmbed`, `wrapEmbedMany`)
- Cost estimation for Claude 3.5/4 models
- Batch queue with configurable flush interval

### Fixed

- Streaming response handling for tool calls
- Race condition in concurrent span updates

## [0.1.1] - 2025-01-15

### Added

- OpenAI wrapper with automatic tracing
- Streaming support for chat completions
- Tool call tracing

### Fixed

- Circular reference handling in `safeStringify`

## [0.1.0] - 2025-01-10

### Added

- Initial release
- `AgentGov` client class
- Manual tracing API (`trace`, `endTrace`, `span`, `endSpan`)
- Context management (`withTrace`, `withSpan`)
- Retry logic with exponential backoff
- TypeScript types for traces and spans

[Unreleased]: https://github.com/agentgov-co/agentgov/compare/sdk-v0.1.2...HEAD
[0.1.2]: https://github.com/agentgov-co/agentgov/compare/sdk-v0.1.1...sdk-v0.1.2
[0.1.1]: https://github.com/agentgov-co/agentgov/compare/sdk-v0.1.0...sdk-v0.1.1
[0.1.0]: https://github.com/agentgov-co/agentgov/releases/tag/sdk-v0.1.0
