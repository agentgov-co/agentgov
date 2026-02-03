/**
 * OpenAI Integration Example
 *
 * This example demonstrates automatic tracing of OpenAI API calls.
 *
 * Prerequisites:
 * 1. AgentGov API running at http://localhost:3001
 * 2. A project created with an API key
 * 3. OpenAI API key
 *
 * Run:
 *   AGENTGOV_API_KEY=ag_xxx AGENTGOV_PROJECT_ID=xxx OPENAI_API_KEY=sk-xxx npx tsx examples/openai-example.ts
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
    debug: true, // Enable debug logging
  });

  console.log("AgentGov initialized\n");

  // Wrap OpenAI client for automatic tracing
  const openai = ag.wrapOpenAI(
    new OpenAI({
      apiKey: openaiKey,
    })
  );

  console.log("Making OpenAI API call...\n");

  // Make a traced call
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is the capital of France? Answer briefly." },
    ],
    max_tokens: 100,
  });

  console.log("Response:", response.choices[0].message.content);
  console.log("\nTokens used:", response.usage);
  console.log("\n✅ Check AgentGov dashboard for the trace!");
}

main().catch(console.error);
