const SENSITIVE_PATTERNS = [
  /\/[^\s]+\.(ts|js|mjs|cjs):\d+/,            // File paths with line numbers
  /at\s+\w+\s*\([^)]+\)/,                      // Stack trace frames
  /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i, // SQL fragments
  /prisma\.\w+\.\w+/i,                         // Prisma operation details
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/,          // Connection error codes
]

/** Sanitize error messages to prevent leaking internal details to clients */
export function sanitizeErrorMessage(message: string, statusCode: number): string {
  if (statusCode >= 500) {
    return 'An unexpected error occurred'
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return 'An error occurred while processing your request'
    }
  }

  return message
}
