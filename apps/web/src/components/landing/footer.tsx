import { Logo } from "@/components/logo"
import { BorderedContainer } from "./bordered-container"

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-black/10">
      <BorderedContainer className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          <Logo size="sm" />
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-2 text-sm text-black/50">
            <a
              href="#features"
              className="hover:text-black transition-colors"
            >
              Features
            </a>
            <a
              href="#compliance"
              className="hover:text-black transition-colors"
            >
              Compliance
            </a>
            <a href="#pricing" className="hover:text-black transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-black transition-colors">
              FAQ
            </a>
            <a
              href="https://github.com/agentgov-co/agentgov"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black transition-colors"
            >
              GitHub
            </a>
            <a
              href="mailto:omadillo@agentgov.co"
              className="hover:text-black transition-colors"
            >
              Support
            </a>
          </div>
          <p className="text-sm text-black/40">&copy; 2026 AgentGov</p>
        </div>
      </BorderedContainer>
    </footer>
  )
}
