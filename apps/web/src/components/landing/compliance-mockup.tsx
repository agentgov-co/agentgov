import { AlertTriangle } from "lucide-react"

export function ComplianceMockup(): React.JSX.Element {
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
  )
}
