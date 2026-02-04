import {
  HeaderNav,
  HeroSection,
  IntegrationsSection,
  DottedSeparator,
  HowItWorksSection,
  CodePreviewSection,
  ComplianceSection,
  MonitoringSection,
  FeaturesSection,
  PricingSection,
  FAQWrapper,
  CTASection,
  Footer,
} from "@/components/landing";

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
