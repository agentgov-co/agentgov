import { HowItWorks } from "./how-it-works"
import { SectionLabel } from "./section-label"
import { BorderedContainer } from "./bordered-container"

export function HowItWorksSection(): React.JSX.Element {
  return (
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
  )
}
