/**
 * OpenAI Agents SDK Integration Example
 *
 * This example demonstrates automatic tracing of multi-agent workflows
 * using the @openai/agents SDK with AgentGov.
 *
 * Prerequisites:
 * 1. AgentGov API running at http://localhost:3001
 * 2. A project created with an API key
 * 3. OpenAI API key
 *
 * Install dependencies:
 *   npm install @openai/agents openai
 *
 * Run:
 *   AGENTGOV_API_KEY=ag_xxx AGENTGOV_PROJECT_ID=xxx OPENAI_API_KEY=sk-xxx npx tsx examples/openai-agents-example.ts
 */

import { Agent, run } from "@openai/agents";
import { BatchTraceProcessor, setTraceProcessors, getGlobalTraceProvider } from "@openai/agents";
import { AgentGovExporter } from "@agentgov/sdk/openai-agents";

// ============================================
// Configuration
// ============================================

const AGENTGOV_API_KEY = process.env.AGENTGOV_API_KEY;
const AGENTGOV_PROJECT_ID = process.env.AGENTGOV_PROJECT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!AGENTGOV_API_KEY || !AGENTGOV_PROJECT_ID) {
  console.error("Missing AGENTGOV_API_KEY or AGENTGOV_PROJECT_ID");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// ============================================
// Setup AgentGov Tracing
// ============================================

const exporter = new AgentGovExporter({
  apiKey: AGENTGOV_API_KEY,
  projectId: AGENTGOV_PROJECT_ID,
  baseUrl: "http://localhost:3001", // Use production URL in prod
  debug: true, // Enable debug logging
  onError: (error, context) => {
    console.error(`[AgentGov] Export error (${context.operation}):`, error.message);
  },
});

// Configure the trace processor
setTraceProcessors([
  new BatchTraceProcessor(exporter, {
    maxBatchSize: 10,
    scheduleDelay: 1000, // Export every 1 second
  }),
]);

console.log("AgentGov tracing configured\n");

// ============================================
// Define Tools
// ============================================

const getWeatherTool = {
  name: "get_weather",
  description: "Get the current weather for a location",
  parameters: {
    type: "object" as const,
    properties: {
      location: {
        type: "string",
        description: "The city name, e.g. 'Tokyo'",
      },
    },
    required: ["location"],
  },
  // Tool implementation
  execute: async (args: { location: string }) => {
    // Simulated weather data
    const weatherData: Record<string, { temp: number; condition: string }> = {
      tokyo: { temp: 22, condition: "Sunny" },
      london: { temp: 15, condition: "Cloudy" },
      "new york": { temp: 18, condition: "Partly cloudy" },
      paris: { temp: 20, condition: "Clear" },
    };

    const location = args.location.toLowerCase();
    const weather = weatherData[location] || { temp: 20, condition: "Unknown" };

    return JSON.stringify({
      location: args.location,
      temperature: weather.temp,
      condition: weather.condition,
      unit: "celsius",
    });
  },
};

// ============================================
// Define Agent
// ============================================

const weatherAgent = new Agent({
  name: "WeatherAgent",
  model: "gpt-4o-mini",
  instructions: `You are a helpful weather assistant. When asked about weather:
1. Use the get_weather tool to fetch current conditions
2. Provide a friendly, concise summary of the weather
3. Include temperature and conditions in your response`,
  tools: [getWeatherTool],
});

// ============================================
// Run Agent
// ============================================

async function main() {
  console.log("Running weather agent...\n");

  try {
    // Run the agent with a user query
    const result = await run(weatherAgent, "What's the weather like in Tokyo today?");

    console.log("\n--- Agent Response ---");
    console.log(result.finalOutput);
    console.log("----------------------\n");

    // Force flush traces before exit
    console.log("Flushing traces...");
    await getGlobalTraceProvider().forceFlush();

    // Show cache stats
    const stats = exporter.getCacheStats();
    console.log(`\nCache stats: ${stats.traces} traces, ${stats.spans} spans exported`);

    console.log("\nCheck AgentGov dashboard for the complete trace!");
    console.log("You should see:");
    console.log("  - Agent span (WeatherAgent)");
    console.log("  - LLM call span (gpt-4o-mini)");
    console.log("  - Tool call span (get_weather)");

  } catch (error) {
    console.error("Agent error:", error);
    process.exit(1);
  }
}

main();
