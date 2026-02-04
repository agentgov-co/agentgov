import { FAQSection } from "./faq-section"

export function FAQWrapper(): React.JSX.Element {
  return (
    <section
      className="bg-black text-white border-b border-white/10"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }}
    >
      <FAQSection />
    </section>
  )
}
