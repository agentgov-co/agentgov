export function TimelineMockup(): React.JSX.Element {
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
  ]

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
  )
}
