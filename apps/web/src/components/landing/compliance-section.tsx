import { SectionLabel } from "./section-label"
import { BorderedContainer } from "./bordered-container"
import { ComplianceMockup } from "./compliance-mockup"

export function ComplianceSection(): React.JSX.Element {
  return (
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
  )
}
