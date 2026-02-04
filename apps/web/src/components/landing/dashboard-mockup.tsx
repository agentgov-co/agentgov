export function DashboardMockup(): React.JSX.Element {
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
  )
}
