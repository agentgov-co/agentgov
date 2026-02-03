/**
 * Vercel AI SDK Integration Example
 *
 * This example demonstrates automatic tracing with Vercel AI SDK.
 *
 * Prerequisites:
 * 1. AgentGov API running at http://localhost:3001
 * 2. A project created with an API key
 * 3. OpenAI API key
 * 4. Install: pnpm add ai @ai-sdk/openai
 *
 * Run:
 *   AGENTGOV_API_KEY=ag_xxx AGENTGOV_PROJECT_ID=xxx OPENAI_API_KEY=sk-xxx npx tsx examples/vercel-ai-example.ts
 */

import { AgentGov } from "@agentgov/sdk";

// Note: In a real project, you would import these:
// import { generateText, streamText } from 'ai'
// import { openai } from '@ai-sdk/openai'

// For this example, we'll create mock functions to demonstrate the API
// Replace these with actual Vercel AI SDK imports in your project

interface MockModel {
  modelId: string;
  provider: string;
}

interface MockResult {
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string;
}

// Mock generateText for demonstration
async function mockGenerateText(options: {
  model: MockModel;
  prompt: string;
}): Promise<MockResult> {
  console.log(`  [Mock] Calling ${options.model.provider}/${options.model.modelId}`);
  console.log(`  [Mock] Prompt: "${options.prompt}"`);

  // Simulate API delay
  await new Promise((r) => setTimeout(r, 500));

  return {
    text: "This is a mock response from the AI model.",
    usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
    finishReason: "stop",
  };
}

// Mock model
const mockOpenAI = (modelId: string): MockModel => ({
  modelId,
  provider: "openai",
});

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
  // Example 1: Wrap generateText
  // ============================================

  console.log("Example 1: Wrapped generateText\n");

  // In real code:
  // const tracedGenerateText = ag.wrapGenerateText(generateText)
  const tracedGenerateText = ag.wrapGenerateText(mockGenerateText);

  const result = await tracedGenerateText({
    model: mockOpenAI("gpt-4o"),
    prompt: "What is the meaning of life?",
  });

  console.log("\nResult:", result.text);
  console.log("Usage:", result.usage);

  // ============================================
  // Example 2: Within a trace context
  // ============================================

  console.log("\n\nExample 2: Within a trace context\n");

  await ag.withTrace({ name: "Multi-step AI Pipeline" }, async () => {
    // Step 1: Generate initial response
    const step1 = await tracedGenerateText({
      model: mockOpenAI("gpt-4o"),
      prompt: "Generate a topic for a blog post",
    });
    console.log("Step 1 result:", step1.text);

    // Step 2: Expand on the topic
    const step2 = await tracedGenerateText({
      model: mockOpenAI("gpt-4o"),
      prompt: `Write an outline for: ${step1.text}`,
    });
    console.log("Step 2 result:", step2.text);

    return { topic: step1.text, outline: step2.text };
  });

  console.log("\n✅ Check AgentGov dashboard for the traces!");
  console.log("   You should see:");
  console.log("   - One standalone trace for Example 1");
  console.log("   - One trace with nested spans for Example 2");

  // Cleanup
  await ag.shutdown();
}

main().catch(console.error);
