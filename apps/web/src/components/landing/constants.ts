import {
  Activity,
  DollarSign,
  Eye,
  Zap,
  Shield,
  AlertTriangle,
  Users,
  FolderOpen,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const integrations = [
  { name: "OpenAI", text: "OpenAI" },
  { name: "Anthropic", text: "Anthropic" },
  { name: "Vercel AI", text: "▲ Vercel AI" },
  { name: "LangChain", text: "LangChain" },
]

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

export const features: Feature[] = [
  {
    icon: Activity,
    title: "Full Tracing",
    description:
      "Track every LLM call, tool use, and agent step with detailed cost and latency metrics.",
  },
  {
    icon: Shield,
    title: "EU AI Act Compliance",
    description:
      "Risk classification, impact assessments, and incident tracking aligned with EU AI Act requirements.",
  },
  {
    icon: DollarSign,
    title: "Cost Analytics",
    description:
      "Real-time cost tracking per model, project, and user. Never overspend on API calls.",
  },
  {
    icon: Eye,
    title: "Timeline & Tree Views",
    description:
      "Gantt-style timeline and hierarchy tree views for every trace. See exactly how your agent executes.",
  },
  {
    icon: Zap,
    title: "Zero-config SDK",
    description:
      "Drop-in wrappers for OpenAI and Vercel AI. Start tracing in under 5 minutes.",
  },
  {
    icon: FolderOpen,
    title: "Multi-Project Workspaces",
    description:
      "Isolated API keys, per-project analytics, and separate environments for every team.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Invite team members, enforce two-factor authentication, and assign roles with fine-grained permissions.",
  },
  {
    icon: AlertTriangle,
    title: "Incident Management",
    description:
      "Track incidents with severity levels, automatic audit trails, and resolution workflows.",
  },
]

export interface Plan {
  name: string
  price: string
  description: string
  badge?: string
  popular?: boolean
  cta: string
  ctaLink: string
}

export const plans: Plan[] = [
  {
    name: "Free",
    price: "0",
    description: "For personal projects",
    badge: "Free in Beta",
    cta: "Start Free",
    ctaLink: "/register",
  },
  {
    name: "Starter",
    price: "29",
    description: "For small teams",
    badge: "Free in Beta",
    cta: "Start Free",
    ctaLink: "/register",
  },
  {
    name: "Pro",
    price: "99",
    description: "For growing companies",
    popular: true,
    badge: "Free in Beta",
    cta: "Start Free",
    ctaLink: "/register",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    cta: "Contact Sales",
    ctaLink: "mailto:omadillo@agentgov.co",
  },
]

export interface PricingRow {
  category?: string
  label: string
  values: string[]
}

export const pricingRows: PricingRow[] = [
  {
    category: "Observability",
    label: "Traces",
    values: ["10K/mo", "100K/mo", "500K/mo", "Unlimited"],
  },
  { label: "Projects", values: ["1", "5", "Unlimited", "Unlimited"] },
  { label: "Retention", values: ["7 days", "30 days", "90 days", "Custom"] },
  { label: "Team", values: ["1", "3", "10", "Unlimited"] },
  {
    category: "EU AI Act",
    label: "AI Systems",
    values: ["1", "3", "15", "Unlimited"],
  },
  { label: "Risk Classification", values: ["✓", "✓", "✓", "✓"] },
  { label: "Doc Generation", values: ["—", "Basic", "Full", "Custom"] },
  { label: "FRIA Reports", values: ["—", "—", "✓", "✓"] },
  { label: "Incident Tracking", values: ["—", "✓", "✓", "✓"] },
  { label: "Audit Export", values: ["—", "—", "✓", "✓"] },
]
