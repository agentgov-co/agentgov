import { Fragment } from "react";
import Link from "next/link";
import {
  Activity,
  DollarSign,
  Eye,
  Zap,
  ArrowRight,
  Check,
  Shield,
  AlertTriangle,
  Users,
  FolderOpen,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TrustedBy } from "@/components/landing/trusted-by";
import { HeaderNav } from "@/components/landing/header-nav";
import { BorderBeam } from "@/components/ui/border-beam";

const integrations = [
  { name: "OpenAI", text: "OpenAI" },
  { name: "Anthropic", text: "Anthropic" },
  { name: "Vercel AI", text: "▲ Vercel AI" },
  { name: "LangChain", text: "LangChain" },
];

const features = [
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
];

const plans = [
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
];

const pricingRows: {
  category?: string;
  label: string;
  values: string[];
}[] = [
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
];

// Section label component [01] SECTION NAME
function SectionLabel({
  number,
  label,
}: {
  number: string;
  label: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm text-black/40 font-mono">[{number}]</span>
      <span className="text-sm text-black/40 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// Dashboard mockup component
function DashboardMockup(): React.JSX.Element {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-black/10 overflow-hidden">
      {/* Window header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 border-b border-black/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-black/10" />
          <div className="w-3 h-3 rounded-full bg-black/10" />
          <div className="w-3 h-3 rounded-full bg-black/10" />
        </div>
        <span className="text-xs text-black/40 ml-2">
          dashboard.agentgov.io
        </span>
      </div>

      {/* Dashboard content */}
      <div className="p-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="text-xs text-black/40 mb-1">Total Traces</div>
            <div className="text-lg font-semibold">12,847</div>
            <div className="text-xs text-emerald-600">+12.5%</div>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="text-xs text-black/40 mb-1">Active Agents</div>
            <div className="text-lg font-semibold">24</div>
            <div className="text-xs text-emerald-600">+3 new</div>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="text-xs text-black/40 mb-1">Total Cost</div>
            <div className="text-lg font-semibold">$142.50</div>
            <div className="text-xs text-black/40">this month</div>
          </div>
        </div>

        {/* Chart placeholder */}
        <div className="bg-neutral-50 rounded-lg p-3 mb-4">
          <div className="text-xs text-black/40 mb-2">Traces over time</div>
          <div className="flex items-end gap-1 h-16">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-[#7C3AED] rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Recent traces */}
        <div className="space-y-2">
          <div className="text-xs text-black/40">Recent traces</div>
          {[
            { name: "chat-completion", status: "completed", time: "2s ago" },
            { name: "tool-call: search", status: "completed", time: "5s ago" },
            { name: "agent-step", status: "running", time: "now" },
          ].map((trace, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${trace.status === "running" ? "bg-[#7C3AED] animate-pulse" : "bg-emerald-500"}`}
                />
                <span className="text-sm font-medium">{trace.name}</span>
              </div>
              <span className="text-xs text-black/40">{trace.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main layout wrapper with side borders
function BorderedContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`mx-auto max-w-332.5 border-x border-black/10 ${className}`}
    >
      {children}
    </div>
  );
}

// Compliance dashboard mockup
function ComplianceMockup(): React.JSX.Element {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-black/10 overflow-hidden">
      {/* Window header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 border-b border-black/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-black/10" />
          <div className="w-3 h-3 rounded-full bg-black/10" />
          <div className="w-3 h-3 rounded-full bg-black/10" />
        </div>
        <span className="text-xs text-black/40 ml-2">
          compliance — agentgov
        </span>
      </div>

      <div className="p-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="text-xs text-black/40 mb-1">Total Systems</div>
            <div className="text-lg font-semibold">12</div>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="text-xs text-black/40 mb-1">High Risk</div>
            <div className="text-lg font-semibold text-red-600">3</div>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3">
            <div className="text-xs text-black/40 mb-1">Compliant</div>
            <div className="text-lg font-semibold text-emerald-600">8</div>
          </div>
        </div>

        {/* Risk distribution bar */}
        <div className="mb-4">
          <div className="text-xs text-black/40 mb-2">Risk Distribution</div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-red-500 w-[15%]" />
            <div className="bg-orange-400 w-[20%]" />
            <div className="bg-yellow-400 w-[25%]" />
            <div className="bg-emerald-500 w-[40%]" />
          </div>
          <div className="flex justify-between text-[10px] text-black/30 mt-1">
            <span>Unacceptable</span>
            <span>High</span>
            <span>Limited</span>
            <span>Minimal</span>
          </div>
        </div>

        {/* AI Systems mini-table */}
        <div className="mb-4">
          <div className="text-xs text-black/40 mb-2">AI Systems</div>
          <div className="space-y-1.5">
            {[
              {
                name: "Customer Support Agent",
                risk: "High",
                status: "Compliant",
                riskColor: "bg-red-100 text-red-700",
                statusColor: "bg-emerald-100 text-emerald-700",
              },
              {
                name: "Document Classifier",
                risk: "Limited",
                status: "Review",
                riskColor: "bg-yellow-100 text-yellow-700",
                statusColor: "bg-amber-100 text-amber-700",
              },
              {
                name: "Content Moderator",
                risk: "High",
                status: "Compliant",
                riskColor: "bg-red-100 text-red-700",
                statusColor: "bg-emerald-100 text-emerald-700",
              },
            ].map((sys) => (
              <div
                key={sys.name}
                className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2"
              >
                <span className="text-sm font-medium truncate mr-2">
                  {sys.name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sys.riskColor}`}
                  >
                    {sys.risk}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sys.statusColor}`}
                  >
                    {sys.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent incident */}
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span className="text-xs font-medium text-red-700">
              Recent Incident
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-600 text-white font-medium ml-auto">
              CRITICAL
            </span>
          </div>
          <p className="text-xs text-red-600/70">
            PII detected in agent output — auto-blocked
          </p>
        </div>
      </div>
    </div>
  );
}

// Timeline/Gantt mockup for real-time monitoring
function TimelineMockup(): React.JSX.Element {
  const spans = [
    {
      name: "agent_run",
      start: 0,
      width: 100,
      color: "bg-amber-500",
      indent: 0,
    },
    {
      name: "llm_call",
      start: 5,
      width: 30,
      color: "bg-purple-500",
      indent: 1,
    },
    {
      name: "tool_call: search",
      start: 38,
      width: 22,
      color: "bg-blue-500",
      indent: 1,
    },
    {
      name: "llm_call",
      start: 63,
      width: 25,
      color: "bg-purple-500",
      indent: 1,
    },
    {
      name: "tool_call: write",
      start: 90,
      width: 10,
      color: "bg-blue-500",
      indent: 1,
    },
  ];

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Window header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <span className="text-xs text-white/30 ml-2">trace — timeline</span>
      </div>

      <div className="p-4">
        {/* Tab toggle */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
          <div className="px-3 py-1 rounded-md bg-white/10 text-xs text-white font-medium">
            Timeline
          </div>
          <div className="px-3 py-1 rounded-md text-xs text-white/40">Tree</div>
        </div>

        {/* Time markers */}
        <div className="flex justify-between text-[10px] text-white/30 mb-2 px-24">
          <span>0ms</span>
          <span>500ms</span>
          <span>1.0s</span>
          <span>1.5s</span>
          <span>2.0s</span>
        </div>

        {/* Span bars */}
        <div className="space-y-2">
          {spans.map((span, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="text-xs text-white/50 font-mono shrink-0 w-20 text-right truncate"
                style={{ paddingLeft: `${span.indent * 8}px` }}
              >
                {span.name}
              </span>
              <div className="flex-1 h-6 relative bg-white/5 rounded">
                <div
                  className={`absolute h-full ${span.color} rounded opacity-80`}
                  style={{
                    left: `${span.start}%`,
                    width: `${span.width}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-white/40">
            Live via WebSocket — 24ms latency
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-white">
      {/* Navigation (includes beta banner) */}
      <HeaderNav />

      {/* Hero */}
      <section className="border-b border-black/10 pt-16">
        <BorderedContainer>
          <div className="grid lg:grid-cols-2 min-h-150">
            {/* Left: Text */}
            <div className="px-4 sm:px-6 py-12 sm:py-20 lg:py-32 lg:pr-16 lg:border-r border-black/10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#7C3AED]/10 text-[#7C3AED] rounded-full text-sm mb-8">
                Now in public beta
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.05] mb-6">
                AI Agent
                <br />
                Governance.
              </h1>
              <p className="text-lg sm:text-xl text-black/50 mb-8 max-w-md leading-relaxed">
                Enterprise-grade tracing and compliance for AI agents. Complete
                visibility into every LLM call, tool use, and decision.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors"
                >
                  Start Free <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-black rounded-lg font-medium hover:bg-black/5 transition-colors"
                >
                  Learn more
                </a>
              </div>
            </div>

            {/* Right: Mockup */}
            <div
              className="px-6 py-12 lg:py-20 lg:pl-16 flex items-center justify-center bg-neutral-50"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)`,
                backgroundSize: "20px 20px",
              }}
            >
              <BorderBeam duration={8} colorFrom="#7C3AED" colorTo="#8b5cf6">
                <DashboardMockup />
              </BorderBeam>
            </div>
          </div>
        </BorderedContainer>
      </section>

      {/* Integrations */}
      <section className="border-b border-black/10">
        <BorderedContainer>
          <TrustedBy logos={integrations} title="Integrates with" />
        </BorderedContainer>
      </section>

      {/* Dotted separator */}
      <div className="border-b border-black/10">
        <div
          className="h-12 sm:h-24 w-full"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      {/* How it works - with left list and right mockup like wist.chat */}
      <section className="border-b border-black/10">
        <BorderedContainer>
          {/* Header */}
          <div className="px-4 sm:px-6 py-10 sm:py-16 border-b border-black/10">
            <SectionLabel number="01" label="How it works" />
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] max-w-3xl">
              <span className="text-black">
                Three steps to complete visibility.
              </span>{" "}
              <span className="text-black/40">
                Start monitoring your AI agents in under 5 minutes with zero
                configuration.
              </span>
            </h2>
          </div>

          {/* Interactive content grid with steps on left, mockup on right */}
          <HowItWorks />
        </BorderedContainer>
      </section>

      {/* Dotted separator */}
      <div className="border-b border-black/10">
        <div
          className="h-12 sm:h-24 w-full"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      {/* Code Preview - Dark section */}
      <section
        className="bg-black text-white border-b border-white/10"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      >
        <div className="mx-auto max-w-332.5 border-x border-white/10">
          <div className="grid lg:grid-cols-2">
            <div className="px-4 sm:px-6 py-12 sm:py-20 lg:py-32 lg:pr-16 lg:border-r border-white/10">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <span className="text-sm text-white/40 font-mono">[02]</span>
                <span className="text-sm text-white/40 uppercase tracking-wider">
                  Integration
                </span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] mb-6">
                <span className="text-white">Drop-in integration.</span>{" "}
                <span className="text-white/40">No code changes needed.</span>
              </h2>
              <p className="text-lg text-white/50 max-w-md">
                Wrap your existing OpenAI or Vercel AI client. All calls are
                automatically traced with full context.
              </p>
            </div>

            <div className="px-4 sm:px-6 py-8 sm:py-12 lg:py-20 lg:pl-16">
              <div className="bg-white/5 rounded-xl p-4 sm:p-6 font-mono text-xs sm:text-sm border border-white/10 overflow-x-auto">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <span className="ml-2 text-white/30 text-xs">index.ts</span>
                </div>
                <pre className="overflow-x-auto leading-relaxed">
                  <code>
                    <span className="text-[#c792ea]">import</span>
                    <span className="text-white/80">{` { AgentGov } `}</span>
                    <span className="text-[#c792ea]">from</span>
                    <span className="text-[#c3e88d]">{` '@agentgov/sdk'`}</span>
                    {"\n"}
                    <span className="text-[#c792ea]">import</span>
                    <span className="text-white/80">{` OpenAI `}</span>
                    <span className="text-[#c792ea]">from</span>
                    <span className="text-[#c3e88d]">{` 'openai'`}</span>
                    {"\n\n"}
                    <span className="text-[#c792ea]">const</span>
                    <span className="text-white/80">{` ag = `}</span>
                    <span className="text-[#c792ea]">new</span>
                    <span className="text-[#82aaff]">{` AgentGov`}</span>
                    <span className="text-white/80">{`({`}</span>
                    {"\n"}
                    <span className="text-white/80">{`  apiKey: process.env.`}</span>
                    <span className="text-[#ffcb6b]">AGENTGOV_API_KEY</span>
                    {"\n"}
                    <span className="text-white/80">{`})`}</span>
                    {"\n\n"}
                    <span className="text-[#c792ea]">const</span>
                    <span className="text-white/80">{` openai = ag.`}</span>
                    <span className="text-[#82aaff]">wrapOpenAI</span>
                    <span className="text-white/80">{`(`}</span>
                    <span className="text-[#c792ea]">new</span>
                    <span className="text-[#82aaff]">{` OpenAI`}</span>
                    <span className="text-white/80">{`())`}</span>
                    {"\n\n"}
                    <span className="text-white/30">{`// All calls are now traced`}</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dotted separator */}
      <div className="border-b border-black/10">
        <div
          className="h-12 sm:h-24 w-full"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      {/* Compliance Showcase */}
      <section id="compliance" className="border-b border-black/10">
        <BorderedContainer>
          <div className="grid lg:grid-cols-2">
            {/* Left: Text */}
            <div className="px-4 sm:px-6 py-12 sm:py-20 lg:py-32 lg:pr-16 lg:border-r border-black/10">
              <SectionLabel number="03" label="Compliance" />
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] mb-6">
                <span className="text-black">EU AI Act ready.</span>{" "}
                <span className="text-black/40">
                  Classify risk levels, run impact assessments, and track
                  incidents — all in one place.
                </span>
              </h2>
              <p className="text-lg text-black/50 max-w-md leading-relaxed">
                Automatically categorize your AI systems by risk tier, monitor
                compliance status across your organization, and maintain
                audit-ready documentation.
              </p>
            </div>

            {/* Right: Mockup */}
            <div
              className="px-6 py-12 lg:py-20 lg:pl-16 flex items-center justify-center"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)`,
                backgroundSize: "20px 20px",
              }}
            >
              <ComplianceMockup />
            </div>
          </div>
        </BorderedContainer>
      </section>

      {/* Real-time Monitoring - Dark section */}
      <section
        className="bg-black text-white border-b border-white/10"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      >
        <div className="mx-auto max-w-332.5 border-x border-white/10">
          <div className="grid lg:grid-cols-2">
            {/* Left: Mockup */}
            <div className="px-4 sm:px-6 py-8 sm:py-12 lg:py-20 lg:pr-16 lg:border-r border-white/10 flex items-center">
              <TimelineMockup />
            </div>

            {/* Right: Text */}
            <div className="px-4 sm:px-6 py-12 sm:py-20 lg:py-32 lg:pl-16">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <span className="text-sm text-white/40 font-mono">[04]</span>
                <span className="text-sm text-white/40 uppercase tracking-wider">
                  Monitoring
                </span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] mb-6">
                <span className="text-white">Real-time tracing.</span>{" "}
                <span className="text-white/40">
                  Watch every span as it happens.
                </span>
              </h2>
              <p className="text-lg text-white/50 max-w-md leading-relaxed">
                Gantt-style timeline and hierarchy tree views for every trace.
                Live updates via WebSocket so you see agent execution as it
                unfolds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dotted separator */}
      <div className="border-b border-black/10">
        <div
          className="h-12 sm:h-24 w-full"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      {/* Features */}
      <section id="features" className="border-b border-black/10">
        <BorderedContainer>
          <div className="px-4 sm:px-6 py-10 sm:py-16 border-b border-black/10">
            <SectionLabel number="05" label="Features" />
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] max-w-3xl">
              <span className="text-black">Everything you need.</span>{" "}
              <span className="text-black/40">
                Complete visibility and control over your AI agent operations.
              </span>
            </h2>
          </div>

          {/* Features grid with borders */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 border-black/10">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 sm:p-8 border-b border-black/10 last:border-b-0 md:nth-last-[-n+2]:border-b-0 lg:nth-last-[-n+2]:border-b lg:nth-last-[-n+4]:border-b-0 md:border-r md:nth-[2n]:border-r-0 lg:nth-[2n]:border-r lg:nth-[4n]:border-r-0"
              >
                <div className="w-10 h-10 mb-4 flex items-center justify-center rounded-lg bg-[#7C3AED]/10">
                  <feature.icon className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                <p className="text-black/50 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </BorderedContainer>
      </section>

      {/* Dotted separator */}
      <div className="border-b border-black/10">
        <div
          className="h-12 sm:h-24 w-full"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      {/* Pricing */}
      <section
        id="pricing"
        className="border-b border-black/10 overflow-x-auto"
      >
        <BorderedContainer>
          <div className="px-4 sm:px-6 py-10 sm:py-16 border-b border-black/10">
            <SectionLabel number="06" label="Pricing" />
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] max-w-3xl">
              <span className="text-black">Simple pricing.</span>{" "}
              <span className="text-black/40">
                Start free, scale as you grow. No hidden fees.
              </span>
            </h2>
          </div>

          {/* Pricing comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-225">
              {/* Plan headers */}
              <thead>
                <tr className="border-b border-black/10">
                  <th className="p-6 text-left w-50" />
                  {plans.map((plan) => (
                    <th
                      key={plan.name}
                      className={`p-6 text-left ${plan.popular ? "bg-[#7C3AED]/5" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {plan.popular && (
                          <span className="inline-block px-3 py-1 text-xs font-medium bg-[#7C3AED] text-white rounded-full">
                            Popular
                          </span>
                        )}
                        {plan.badge && (
                          <span className="inline-block px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-lg">{plan.name}</div>
                      <p className="text-sm text-black/50 font-normal mb-3">
                        {plan.description}
                      </p>
                      <div className="text-3xl font-semibold">
                        {plan.price === "Custom" ? (
                          "Custom"
                        ) : plan.badge ? (
                          <>
                            <span className="text-emerald-600">$0</span>
                            {plan.price !== "0" && (
                              <span className="text-lg font-normal text-black/30 line-through ml-2">
                                ${plan.price}/mo
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            ${plan.price}
                            <span className="text-sm font-normal text-black/40">
                              /mo
                            </span>
                          </>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pricingRows.map((row) => (
                  <Fragment key={row.label}>
                    {row.category && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 pt-8 pb-3 text-sm font-semibold uppercase tracking-wider text-black/60 border-b border-black/10"
                        >
                          {row.category}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-black/5">
                      <td className="px-6 py-4 text-sm text-black/60">
                        {row.label}
                      </td>
                      {row.values.map((val, j) => (
                        <td
                          key={j}
                          className={`px-6 py-4 text-sm ${plans[j]?.popular ? "bg-[#7C3AED]/5" : ""} ${val === "✓" ? "text-[#7C3AED] font-medium" : val === "—" ? "text-black/25" : "text-black/70"}`}
                        >
                          {val === "✓" ? (
                            <Check className="h-4 w-4 text-[#7C3AED]" />
                          ) : (
                            val
                          )}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>

              {/* CTA row */}
              <tfoot>
                <tr>
                  <td className="p-6" />
                  {plans.map((plan) => (
                    <td
                      key={plan.name}
                      className={`p-6 ${plan.popular ? "bg-[#7C3AED]/5" : ""}`}
                    >
                      <Link
                        href={plan.ctaLink}
                        className={`block w-full py-3 text-center rounded-lg font-medium transition-colors ${
                          plan.popular
                            ? "bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90"
                            : "bg-black text-white hover:bg-black/80"
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </BorderedContainer>
      </section>

      {/* Dotted separator */}
      <div className="border-b border-black/10">
        <div
          className="h-12 sm:h-24 w-full"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      {/* CTA */}
      <section
        className="bg-black text-white"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      >
        <div className="mx-auto max-w-332.5 border-x border-white/10 px-4 sm:px-6 py-12 sm:py-20 md:py-32">
          <div className="max-w-3xl">
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight leading-[1.15] mb-6 sm:mb-8">
              <span className="text-white">Ready to get started?</span>{" "}
              <span className="text-white/40">
                Start monitoring your AI agents today. Free tier available, no
                credit card required.
              </span>
            </h2>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors"
            >
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/10">
        <BorderedContainer className="px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <Logo size="sm" />
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-2 text-sm text-black/50">
              <a
                href="#features"
                className="hover:text-black transition-colors"
              >
                Features
              </a>
              <a
                href="#compliance"
                className="hover:text-black transition-colors"
              >
                Compliance
              </a>
              <a href="#pricing" className="hover:text-black transition-colors">
                Pricing
              </a>
              <a
                href="https://github.com/agentgov-co/agentgov"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-black transition-colors"
              >
                GitHub
              </a>
              <a
                href="mailto:omadillo@agentgov.co"
                className="hover:text-black transition-colors"
              >
                Support
              </a>
            </div>
            <p className="text-sm text-black/40">© 2026 AgentGov</p>
          </div>
        </BorderedContainer>
      </footer>
    </main>
  );
}
