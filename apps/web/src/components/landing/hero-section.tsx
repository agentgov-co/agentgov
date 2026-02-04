import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BorderBeam } from "@/components/ui/border-beam"
import { BorderedContainer } from "./bordered-container"
import { DashboardMockup } from "./dashboard-mockup"

export function HeroSection(): React.JSX.Element {
  return (
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
  )
}
