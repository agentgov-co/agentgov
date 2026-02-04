import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CTASection(): React.JSX.Element {
  return (
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
  )
}
