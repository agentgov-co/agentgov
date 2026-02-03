/**
 * Manual Tracing Example
 *
 * This example demonstrates manual trace and span creation
 * for custom operations or non-OpenAI providers.
 *
 * Prerequisites:
 * 1. AgentGov API running at http://localhost:3001
 * 2. A project created with an API key
 *
 * Run:
 *   AGENTGOV_API_KEY=ag_xxx AGENTGOV_PROJECT_ID=xxx npx tsx examples/manual-tracing.ts
 */

import { AgentGov } from "@agentgov/sdk";

// Simulate async operations
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Validate environment
  const apiKey = process.env.AGENTGOV_API_KEY;
  const projectId = process.env.AGENTGOV_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.error("Missing AGENTGOV_API_KEY or AGENTGOV_PROJECT_ID");
    process.exit(1);
  }

  // Initialize AgentGov
  const ag = new AgentGov({
    apiKey,
    projectId,
    baseUrl: "http://localhost:3001",
    debug: true,
  });

  console.log("AgentGov initialized\n");

  // ============================================
  // Example 1: Using withTrace helper
  // ============================================

  console.log("Example 1: Using withTrace helper\n");

  const result = await ag.withTrace(
    {
      name: "Customer Support Agent",
      input: { query: "How do I reset my password?" },
      metadata: { userId: "user_123", channel: "web" },
    },
    async (ctx) => {
      console.log(`Trace started: ${ctx.traceId}`);

      // Step 1: Retrieve relevant documents
      const docs = await ag.withSpan(
        {
          name: "Retrieve Knowledge Base",
          type: "RETRIEVAL",
          metadata: { source: "knowledge_base" },
        },
        async (span) => {
          console.log(`  Span: ${span.name} (${span.id})`);
          await sleep(100); // Simulate retrieval
          return [
            { id: "doc1", content: "Password reset instructions..." },
            { id: "doc2", content: "Account security FAQ..." },
          ];
        }
      );

      console.log(`  Retrieved ${docs.length} documents`);

      // Step 2: Generate embeddings
      await ag.withSpan(
        {
          name: "Generate Query Embedding",
          type: "EMBEDDING",
          model: "text-embedding-3-small",
        },
        async (span) => {
          console.log(`  Span: ${span.name} (${span.id})`);
          await sleep(50); // Simulate embedding
          return [0.1, 0.2, 0.3]; // Fake embedding
        }
      );

      // Step 3: Generate response with LLM
      const response = await ag.withSpan(
        {
          name: "Generate Response",
          type: "LLM_CALL",
          model: "gpt-4",
          input: {
            messages: [
              { role: "system", content: "You are a support agent." },
              { role: "user", content: "How do I reset my password?" },
            ],
          },
        },
        async (span) => {
          console.log(`  Span: ${span.name} (${span.id})`);
          await sleep(200); // Simulate LLM call

          // Manually update span with token metrics
          await ag.endSpan(span.id, {
            status: "COMPLETED",
            output: { content: "To reset your password, go to Settings..." },
            promptTokens: 150,
            outputTokens: 75,
            cost: 0.0067,
          });

          return "To reset your password, go to Settings > Security > Reset Password.";
        }
      );

      return { response, documentsUsed: docs.length };
    }
  );

  console.log("\nResult:", result);

  // ============================================
  // Example 2: Low-level API
  // ============================================

  console.log("\n\nExample 2: Low-level API\n");

  // Create trace manually
  const trace = await ag.trace({
    name: "Data Processing Pipeline",
    metadata: { batchId: "batch_456" },
  });

  console.log(`Trace created: ${trace.id}`);

  // Create span manually
  const span = await ag.span({
    name: "Process Records",
    type: "AGENT_STEP",
    input: { recordCount: 100 },
  });

  console.log(`Span created: ${span.id}`);

  // Simulate processing
  await sleep(150);

  // End span with results
  await ag.endSpan(span.id, {
    status: "COMPLETED",
    output: { processedCount: 100, failedCount: 0 },
    metadata: { processingTime: "150ms" },
  });

  console.log("Span completed");

  // End trace
  await ag.endTrace(trace.id, {
    status: "COMPLETED",
    output: { success: true, totalRecords: 100 },
  });

  console.log("Trace completed");

  console.log("\n✅ Check AgentGov dashboard for the traces!");
}

main().catch(console.error);
