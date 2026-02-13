/**
 * Telegram Bot Notification Service
 *
 * Production-grade implementation with:
 * - Exponential backoff retry with jitter
 * - Request timeout
 * - Rate limiting (respects Telegram's 1 msg/sec limit)
 * - Strict typing
 * - Graceful degradation (never throws, logs errors)
 *
 * @see https://core.telegram.org/bots/api
 * @see https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this
 */

import { logger } from './logger.js'

// ============================================================================
// Configuration
// ============================================================================

interface TelegramConfig {
  botToken: string | undefined
  chatId: string | undefined
}

const config: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
}

// Retry configuration
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 10000

// Rate limiting: Telegram allows ~1 msg/sec per chat
let lastMessageTime = 0
const MIN_INTERVAL_MS = 1000

// ============================================================================
// Types
// ============================================================================

interface TelegramResponse {
  ok: boolean
  description?: string
  error_code?: number
  parameters?: {
    retry_after?: number
  }
}

interface SendMessagePayload {
  chat_id: string
  text: string
  parse_mode: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_notification?: boolean
}

type NotificationType = 'user.registered' | 'feedback.created'

interface BaseNotification {
  type: NotificationType
}

interface UserRegisteredNotification extends BaseNotification {
  type: 'user.registered'
  user: {
    name: string
    email: string
  }
}

interface FeedbackCreatedNotification extends BaseNotification {
  type: 'feedback.created'
  feedback: {
    type: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'OTHER'
    message: string
    page?: string | null
  }
  user: {
    name: string
    email: string
  }
}

type Notification = UserRegisteredNotification | FeedbackCreatedNotification

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if Telegram notifications are configured
 */
export function isTelegramConfigured(): boolean {
  return Boolean(config.botToken && config.chatId)
}

/**
 * Calculate delay with exponential backoff and jitter
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
function calculateBackoff(attempt: number): number {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 100
  return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
}

/**
 * Wait for rate limit
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastMessage = now - lastMessageTime

  if (timeSinceLastMessage < MIN_INTERVAL_MS) {
    const waitTime = MIN_INTERVAL_MS - timeSinceLastMessage
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastMessageTime = Date.now()
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Send message to Telegram with retry logic
 *
 * @returns true if message was sent successfully, false otherwise
 */
async function sendMessageWithRetry(text: string): Promise<boolean> {
  if (!config.botToken || !config.chatId) {
    return false
  }

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`
  const payload: SendMessagePayload = {
    chat_id: config.chatId,
    text,
    parse_mode: 'HTML',
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await waitForRateLimit()

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        REQUEST_TIMEOUT_MS
      )

      const data = await response.json() as TelegramResponse

      if (data.ok) {
        return true
      }

      // Handle rate limit (429)
      if (data.error_code === 429 && data.parameters?.retry_after) {
        const retryAfter = data.parameters.retry_after * 1000
        logger.warn(
          { retryAfter, attempt },
          '[Telegram] Rate limited, waiting before retry'
        )
        await new Promise(resolve => setTimeout(resolve, retryAfter))
        continue
      }

      // Non-retryable error
      logger.error(
        { error: data.description, code: data.error_code },
        '[Telegram] API error'
      )
      return false

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1
      const isAbortError = error instanceof Error && error.name === 'AbortError'

      if (isAbortError) {
        logger.warn({ attempt }, '[Telegram] Request timeout')
      } else {
        logger.warn({ err: error, attempt }, '[Telegram] Request failed')
      }

      if (isLastAttempt) {
        logger.error(
          { err: error },
          '[Telegram] All retry attempts exhausted'
        )
        return false
      }

      const backoff = calculateBackoff(attempt)
      await new Promise(resolve => setTimeout(resolve, backoff))
    }
  }

  return false
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Escape HTML special characters for Telegram
 * @see https://core.telegram.org/bots/api#html-style
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Format timestamp in UTC (ISO 8601)
 */
function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

/**
 * Format notification message
 */
function formatNotification(notification: Notification): string {
  switch (notification.type) {
    case 'user.registered':
      return [
        '<b>New User Registration</b>',
        '',
        `<b>Name:</b> ${escapeHtml(notification.user.name)}`,
        `<b>Email:</b> ${escapeHtml(notification.user.email)}`,
        `<b>Time:</b> ${formatTimestamp()}`,
      ].join('\n')

    case 'feedback.created': {
      const typeLabels: Record<string, string> = {
        BUG: 'Bug Report',
        FEATURE: 'Feature Request',
        IMPROVEMENT: 'Improvement',
        OTHER: 'Feedback',
      }

      const label = typeLabels[notification.feedback.type] || 'Feedback'
      const page = notification.feedback.page
        ? `\n<b>Page:</b> ${escapeHtml(notification.feedback.page)}`
        : ''

      return [
        `<b>${label}</b> from ${escapeHtml(notification.user.name)}`,
        page,
        '',
        escapeHtml(notification.feedback.message),
      ].filter(Boolean).join('\n')
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send a raw message to Telegram (for testing/custom messages)
 * Non-blocking: fires and forgets, logs errors
 */
export function sendTelegramMessage(text: string): void {
  if (!isTelegramConfigured()) {
    logger.debug('[Telegram] Not configured, skipping message')
    return
  }

  void sendMessageWithRetry(text)
}

/**
 * Notify about new user registration
 * Non-blocking: fires and forgets, logs errors
 */
export function notifyNewUser(user: { name: string; email: string }): void {
  if (!isTelegramConfigured()) {
    return
  }

  const message = formatNotification({
    type: 'user.registered',
    user,
  })

  void sendMessageWithRetry(message)
}

/**
 * Notify about new feedback
 * Non-blocking: fires and forgets, logs errors
 */
export function notifyFeedback(params: {
  type: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'OTHER'
  message: string
  page?: string | null
  user: { name: string; email: string }
}): void {
  if (!isTelegramConfigured()) {
    return
  }

  const message = formatNotification({
    type: 'feedback.created',
    feedback: {
      type: params.type,
      message: params.message,
      page: params.page,
    },
    user: params.user,
  })

  void sendMessageWithRetry(message)
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const __testing = {
  calculateBackoff,
  escapeHtml,
  formatTimestamp,
  formatNotification,
  sendMessageWithRetry,
}
