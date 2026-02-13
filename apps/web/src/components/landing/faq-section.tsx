'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const faqs = [
  {
    question: 'What is AgentGov?',
    answer:
      'AgentGov is an AI Agent Governance Platform that provides real-time observability and EU AI Act compliance for AI agents. It helps organizations monitor, secure, and govern their autonomous AI systems with features like tracing, risk classification, and compliance documentation.',
  },
  {
    question: 'Is AgentGov free?',
    answer:
      'Yes! AgentGov offers a free beta tier with 100,000 traces per month, 10 projects, 5 team members, and full access to EU AI Act compliance features. Paid plans start at $29/month after the beta period.',
  },
  {
    question: 'What is EU AI Act compliance?',
    answer:
      'The EU AI Act is European regulation requiring AI systems to meet safety and transparency requirements by August 2026. AgentGov helps you classify AI systems by risk level, generate compliance documentation, track incidents, and configure human oversight.',
  },
  {
    question: 'Which AI frameworks are supported?',
    answer:
      'AgentGov supports OpenAI, Anthropic Claude, and Vercel AI SDK through the @agentgov/sdk npm package. The SDK provides wrapper functions that automatically trace all AI calls. Custom integrations are also supported via REST API.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Sign up at agentgov.co, create a project to get an API key, then install our SDK with npm install @agentgov/sdk. Wrap your AI client and all calls will be automatically traced. Traces appear in your dashboard within seconds.',
  },
  {
    question: 'How is AgentGov different from Langfuse or LangSmith?',
    answer:
      'While Langfuse and LangSmith focus on observability, AgentGov uniquely combines tracing with EU AI Act compliance features including risk classification, FRIA reports, compliance documentation, incident tracking, and human oversight configuration.',
  },
]

export function FAQSection(): React.JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-white/60">
            Everything you need to know about AgentGov
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-white/10 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                aria-expanded={openIndex === index}
              >
                <span className="font-medium text-white">{faq.question}</span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-white/60 transition-transform',
                    openIndex === index && 'rotate-180'
                  )}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-white/70 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
