import { TrustedBy } from "./trusted-by"
import { BorderedContainer } from "./bordered-container"
import { integrations } from "./constants"

export function IntegrationsSection(): React.JSX.Element {
  return (
    <section className="border-b border-black/10">
      <BorderedContainer>
        <TrustedBy logos={integrations} title="Integrates with" />
      </BorderedContainer>
    </section>
  )
}
