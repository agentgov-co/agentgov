/**
 * WebSocket Test Script
 *
 * Tests the WebSocket connection and message handling.
 *
 * Usage:
 *   npx tsx scripts/test-websocket.ts [projectId]
 *
 * Example:
 *   npx tsx scripts/test-websocket.ts my-project
 */

import WebSocket from 'ws'

const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws'
const PROJECT_ID = process.argv[2] || 'test-project'

console.log('🔌 WebSocket Test Script')
console.log(`   URL: ${WS_URL}`)
console.log(`   Project: ${PROJECT_ID}`)
console.log('')

const ws = new WebSocket(`${WS_URL}?projectId=${PROJECT_ID}`)

let messageCount = 0
let pingInterval: NodeJS.Timeout

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server')

  // Subscribe to all channels
  const subscribeMessage = JSON.stringify({
    type: 'subscribe',
    channels: ['traces', 'spans']
  })
  ws.send(subscribeMessage)
  console.log('📤 Sent subscribe message')

  // Set up periodic ping
  pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
      console.log('📤 Ping sent')
    }
  }, 10000)

  console.log('')
  console.log('👀 Listening for messages... (Ctrl+C to exit)')
  console.log('   Create a trace via API to see real-time updates')
  console.log('')
})

ws.on('message', (data) => {
  messageCount++
  try {
    const message = JSON.parse(data.toString())
    const timestamp = new Date().toLocaleTimeString()

    switch (message.type) {
      case 'connected':
        console.log(`[${timestamp}] 🔗 Connected with client ID: ${message.clientId}`)
        break
      case 'pong':
        console.log(`[${timestamp}] 🏓 Pong received (latency check OK)`)
        break
      case 'trace:created':
        console.log(`[${timestamp}] 📊 New trace created:`)
        console.log(`   ID: ${message.data.id}`)
        console.log(`   Name: ${message.data.name || 'unnamed'}`)
        console.log(`   Status: ${message.data.status}`)
        break
      case 'trace:updated':
        console.log(`[${timestamp}] 🔄 Trace updated:`)
        console.log(`   ID: ${message.data.id}`)
        console.log(`   Status: ${message.data.status}`)
        break
      case 'span:created':
        console.log(`[${timestamp}] 📍 New span created:`)
        console.log(`   ID: ${message.data.id}`)
        console.log(`   Trace: ${message.data.traceId}`)
        console.log(`   Name: ${message.data.name}`)
        console.log(`   Type: ${message.data.type}`)
        break
      case 'error':
        console.log(`[${timestamp}] ❌ Error: ${message.message}`)
        break
      default:
        console.log(`[${timestamp}] 📨 Unknown message:`, message)
    }
  } catch (error) {
    console.log(`📨 Raw message: ${data.toString()}`)
  }
})

ws.on('close', (code, reason) => {
  clearInterval(pingInterval)
  console.log('')
  console.log(`❌ Connection closed (code: ${code}, reason: ${reason || 'none'})`)
  console.log(`   Total messages received: ${messageCount}`)
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message)
})

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('')
  console.log('👋 Closing connection...')
  ws.close()
})

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})
