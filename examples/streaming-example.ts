/**
 * OpenAI Streaming Example
 *
 * This example demonstrates automatic tracing of streaming OpenAI API calls.
 *
 * Prerequisites:
 * 1. AgentGov API running at http://localhost:3001
 * 2. A project created with an API key
 * 3. OpenAI API key
 *
 * Run:
 *   AGENTGOV_API_KEY=ag_xxx AGENTGOV_PROJECT_ID=xxx OPENAI_API_KEY=sk-xxx npx tsx examples/streaming-example.ts
 */

import { AgentGov } from "@agentgov/sdk";
import OpenAI from "openai";

async function main() {
  // Validate environment
  const apiKey = process.env.AGENTGOV_API_KEY;
  const projectId = process.env.AGENTGOV_PROJECT_ID;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !projectId) {
    console.error("Missing AGENTGOV_API_KEY or AGENTGOV_PROJECT_ID");
    process.exit(1);
  }

  if (!openaiKey) {
    console.error("Missing OPENAI_API_KEY");
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

  // Wrap OpenAI client for automatic tracing
  const openai = ag.wrapOpenAI(
    new OpenAI({
      apiKey: openaiKey,
    })
  );

  console.log("Making streaming OpenAI API call...\n");
  console.log("Response: ");

  // Make a streaming call - automatically traced!
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Write a haiku about programming." },
    ],
    stream: true,
  });

  // Process the stream
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    process.stdout.write(content);
  }

  console.log("\n\n✅ Stream completed! Check AgentGov dashboard for the trace.");
  console.log("   The trace includes full accumulated content and token usage.");
}

main().catch(console.error);
