import { SectionLabel } from "./section-label"
import { BorderedContainer } from "./bordered-container"
import { features } from "./constants"

export function FeaturesSection(): React.JSX.Element {
  return (
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
  )
}
