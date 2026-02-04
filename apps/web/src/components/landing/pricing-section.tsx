import { Fragment } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { SectionLabel } from "./section-label"
import { BorderedContainer } from "./bordered-container"
import { plans, pricingRows } from "./constants"

export function PricingSection(): React.JSX.Element {
  return (
    <section
      id="pricing"
      className="border-b border-black/10 overflow-x-auto"
    >
      <BorderedContainer>
        <div className="px-4 sm:px-6 py-10 sm:py-16 border-b border-black/10">
          <SectionLabel number="06" label="Pricing" />
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.15] max-w-3xl">
            <span className="text-black">Simple pricing.</span>{" "}
            <span className="text-black/40">
              Start free, scale as you grow. No hidden fees.
            </span>
          </h2>
        </div>

        {/* Pricing comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-225">
            {/* Plan headers */}
            <thead>
              <tr className="border-b border-black/10">
                <th className="p-6 text-left w-50" />
                {plans.map((plan) => (
                  <th
                    key={plan.name}
                    className={`p-6 text-left ${plan.popular ? "bg-[#7C3AED]/5" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {plan.popular && (
                        <span className="inline-block px-3 py-1 text-xs font-medium bg-[#7C3AED] text-white rounded-full">
                          Popular
                        </span>
                      )}
                      {plan.badge && (
                        <span className="inline-block px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-lg">{plan.name}</div>
                    <p className="text-sm text-black/50 font-normal mb-3">
                      {plan.description}
                    </p>
                    <div className="text-3xl font-semibold">
                      {plan.price === "Custom" ? (
                        "Custom"
                      ) : plan.badge ? (
                        <>
                          <span className="text-emerald-600">$0</span>
                          {plan.price !== "0" && (
                            <span className="text-lg font-normal text-black/30 line-through ml-2">
                              ${plan.price}/mo
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          ${plan.price}
                          <span className="text-sm font-normal text-black/40">
                            /mo
                          </span>
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {pricingRows.map((row) => (
                <Fragment key={row.label}>
                  {row.category && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 pt-8 pb-3 text-sm font-semibold uppercase tracking-wider text-black/60 border-b border-black/10"
                      >
                        {row.category}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-black/5">
                    <td className="px-6 py-4 text-sm text-black/60">
                      {row.label}
                    </td>
                    {row.values.map((val, j) => (
                      <td
                        key={j}
                        className={`px-6 py-4 text-sm ${plans[j]?.popular ? "bg-[#7C3AED]/5" : ""} ${val === "✓" ? "text-[#7C3AED] font-medium" : val === "—" ? "text-black/25" : "text-black/70"}`}
                      >
                        {val === "✓" ? (
                          <Check className="h-4 w-4 text-[#7C3AED]" />
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>

            {/* CTA row */}
            <tfoot>
              <tr>
                <td className="p-6" />
                {plans.map((plan) => (
                  <td
                    key={plan.name}
                    className={`p-6 ${plan.popular ? "bg-[#7C3AED]/5" : ""}`}
                  >
                    <Link
                      href={plan.ctaLink}
                      className={`block w-full py-3 text-center rounded-lg font-medium transition-colors ${
                        plan.popular
                          ? "bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90"
                          : "bg-black text-white hover:bg-black/80"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </BorderedContainer>
    </section>
  )
}
