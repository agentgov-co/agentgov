import { TimelineMockup } from "./timeline-mockup"

export function MonitoringSection(): React.JSX.Element {
  return (
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
  )
}
