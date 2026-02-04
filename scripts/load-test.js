/**
 * k6 Load Test — AgentGov Trace Ingestion API
 *
 * Prerequisites:
 *   brew install k6   (or see https://grafana.com/docs/k6/latest/set-up/install-k6/)
 *
 * Usage:
 *   k6 run scripts/load-test.js
 *   k6 run --env API_URL=https://api.agentgov.co --env API_KEY=ag_xxx scripts/load-test.js
 *
 * Scenarios:
 *   smoke   — 5 VUs for 30s   (sanity check)
 *   load    — ramp 0→50 VUs, hold 2m, ramp down
 *   spike   — burst to 100 VUs for 30s
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.API_URL || 'http://localhost:3001'
const API_KEY = __ENV.API_KEY || ''

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const createTraceDuration = new Trend('trace_create_duration', true)
const listTracesDuration = new Trend('trace_list_duration', true)
const apiErrors = new Counter('api_errors')
const errorRate = new Rate('error_rate')

// ---------------------------------------------------------------------------
// Options — scenarios + thresholds
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      startTime: '35s', // start after smoke
      tags: { scenario: 'load' },
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      startTime: '5m', // start after load
      tags: { scenario: 'spike' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    trace_create_duration: ['p(95)<500'],
    trace_list_duration: ['p(95)<300'],
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (API_KEY) h['Authorization'] = `Bearer ${API_KEY}`
  return h
}

// Randomized think-time to avoid accidental request synchronization
function think() {
  sleep(0.3 + Math.random() * 0.7) // 300–1000 ms
}

// ---------------------------------------------------------------------------
// Default function — executed by each VU
// ---------------------------------------------------------------------------

export default function () {
  const params = { headers: headers(), tags: { api: 'v1' } }

  group('create trace', () => {
    const payload = JSON.stringify({
      name: `load-test-${Date.now()}-vu${__VU}`,
      status: 'completed',
      startedAt: new Date(Date.now() - 5000).toISOString(),
      endedAt: new Date().toISOString(),
      metadata: { source: 'k6', vu: __VU, iter: __ITER },
    })

    const res = http.post(`${BASE_URL}/v1/traces`, payload, params)
    createTraceDuration.add(res.timings.duration)

    const ok = check(res, {
      'POST /v1/traces → 2xx': (r) => r.status >= 200 && r.status < 300,
      'has id in body': (r) => {
        try { return !!JSON.parse(r.body).id } catch { return false }
      },
    })

    if (!ok) {
      apiErrors.add(1)
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
  })

  think()

  group('list traces', () => {
    const res = http.get(`${BASE_URL}/v1/traces?limit=20`, params)
    listTracesDuration.add(res.timings.duration)

    const ok = check(res, {
      'GET /v1/traces → 200': (r) => r.status === 200,
      'returns array': (r) => {
        try { return Array.isArray(JSON.parse(r.body)) } catch { return false }
      },
    })

    if (!ok) {
      apiErrors.add(1)
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
  })

  think()
}

// ---------------------------------------------------------------------------
// Custom summary — outputs both stdout and JSON file
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  }
}
