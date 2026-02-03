/**
 * Calculate duration in milliseconds
 */
export function calculateDuration(startTime: number): number {
  return Date.now() - startTime
}

/**
 * Model pricing structure
 */
interface ModelPricing {
  inputPrice: number   // $ per 1M input tokens
  outputPrice: number  // $ per 1M output tokens
}

/**
 * Estimate cost based on model and tokens
 * Prices as of January 2026 (approximate)
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Pricing per 1M tokens - Updated January 2026
  const pricing: Record<string, ModelPricing> = {
    // OpenAI - GPT-5 Series (Flagship)
    'gpt-5.2-pro': { inputPrice: 21.00, outputPrice: 168.00 },
    'gpt-5.2': { inputPrice: 1.75, outputPrice: 14.00 },
    'gpt-5': { inputPrice: 1.25, outputPrice: 10.00 },

    // OpenAI - GPT-4 Series
    'gpt-4.1': { inputPrice: 2.00, outputPrice: 8.00 },
    'gpt-4.1-mini': { inputPrice: 0.40, outputPrice: 1.60 },
    'gpt-4o': { inputPrice: 2.50, outputPrice: 10.00 },
    'gpt-4o-mini': { inputPrice: 0.15, outputPrice: 0.60 },

    // OpenAI - o-Series (Reasoning)
    'o4-mini': { inputPrice: 1.10, outputPrice: 4.40 },
    'o3-pro': { inputPrice: 20.00, outputPrice: 80.00 },
    'o3': { inputPrice: 10.00, outputPrice: 40.00 },
    'o3-mini': { inputPrice: 1.10, outputPrice: 4.40 },
    'o1': { inputPrice: 15.00, outputPrice: 60.00 },
    'o1-mini': { inputPrice: 3.00, outputPrice: 12.00 },

    // OpenAI - Legacy
    'gpt-4-turbo': { inputPrice: 10.00, outputPrice: 30.00 },
    'gpt-4': { inputPrice: 30.00, outputPrice: 60.00 },
    'gpt-3.5-turbo': { inputPrice: 0.50, outputPrice: 1.50 },

    // Anthropic
    'claude-sonnet-4': { inputPrice: 3.00, outputPrice: 15.00 },
    'claude-3.5-sonnet': { inputPrice: 3.00, outputPrice: 15.00 },
    'claude-3.5-haiku': { inputPrice: 0.80, outputPrice: 4.00 },
    'claude-3-opus': { inputPrice: 15.00, outputPrice: 75.00 },
    'claude-3-sonnet': { inputPrice: 3.00, outputPrice: 15.00 },
    'claude-3-haiku': { inputPrice: 0.25, outputPrice: 1.25 },

    // Embeddings (no output tokens)
    'text-embedding-3-small': { inputPrice: 0.02, outputPrice: 0 },
    'text-embedding-3-large': { inputPrice: 0.13, outputPrice: 0 },
    'text-embedding-ada-002': { inputPrice: 0.10, outputPrice: 0 },

    // Default fallback
    'default': { inputPrice: 1.00, outputPrice: 2.00 }
  }

  // Find matching pricing (partial match)
  // Sort keys by length descending so more specific matches come first
  // e.g., "gpt-4o-mini" should match before "gpt-4o"
  let { inputPrice, outputPrice } = pricing['default']

  const sortedKeys = Object.keys(pricing)
    .filter(k => k !== 'default')
    .sort((a, b) => b.length - a.length)

  for (const key of sortedKeys) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      ;({ inputPrice, outputPrice } = pricing[key])
      break
    }
  }

  // Calculate cost (prices are per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * inputPrice
  const outputCost = (outputTokens / 1_000_000) * outputPrice

  return Number((inputCost + outputCost).toFixed(6))
}
