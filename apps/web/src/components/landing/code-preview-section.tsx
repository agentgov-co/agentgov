export function CodePreviewSection(): React.JSX.Element {
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
  )
}
