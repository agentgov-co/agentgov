import nextDynamic from "next/dynamic";
import {
  HeaderNav,
  HeroSection,
  IntegrationsSection,
  DottedSeparator,
} from "@/components/landing";

export const dynamic = "force-static";

const HowItWorksSection = nextDynamic(
  () =>
    import("@/components/landing/how-it-works-section").then(
      (mod) => mod.HowItWorksSection,
    ),
  { ssr: true },
);

const CodePreviewSection = nextDynamic(
  () =>
    import("@/components/landing/code-preview-section").then(
      (mod) => mod.CodePreviewSection,
    ),
  { ssr: true },
);

const ComplianceSection = nextDynamic(
  () =>
    import("@/components/landing/compliance-section").then(
      (mod) => mod.ComplianceSection,
    ),
  { ssr: true },
);

const MonitoringSection = nextDynamic(
  () =>
    import("@/components/landing/monitoring-section").then(
      (mod) => mod.MonitoringSection,
    ),
  { ssr: true },
);

const FeaturesSection = nextDynamic(
  () =>
    import("@/components/landing/features-section").then(
      (mod) => mod.FeaturesSection,
    ),
  { ssr: true },
);

const PricingSection = nextDynamic(
  () =>
    import("@/components/landing/pricing-section").then(
      (mod) => mod.PricingSection,
    ),
  { ssr: true },
);

const FAQWrapper = nextDynamic(
  () =>
    import("@/components/landing/faq-wrapper").then((mod) => mod.FAQWrapper),
  { ssr: true },
);

const CTASection = nextDynamic(
  () =>
    import("@/components/landing/cta-section").then((mod) => mod.CTASection),
  { ssr: true },
);

const Footer = nextDynamic(
  () => import("@/components/landing/footer").then((mod) => mod.Footer),
  { ssr: true },
);

export default function Home(): React.JSX.Element {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-white">
      <HeaderNav />
      <HeroSection />
      <IntegrationsSection />
      <DottedSeparator />
      <HowItWorksSection />
      <DottedSeparator />
      <CodePreviewSection />
      <DottedSeparator />
      <ComplianceSection />
      <MonitoringSection />
      <DottedSeparator />
      <FeaturesSection />
      <DottedSeparator />
      <PricingSection />
      <DottedSeparator />
      <FAQWrapper />
      <CTASection />
      <Footer />
    </main>
  );
}
