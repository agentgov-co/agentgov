export function OrganizationJsonLd(): React.JSX.Element {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AgentGov',
    url: 'https://agentgov.co',
    logo: 'https://agentgov.co/icon',
    description: 'AI Agent Governance Platform with real-time observability and EU AI Act compliance',
    foundingDate: '2026',
    sameAs: [
      'https://github.com/agentgov-co/agentgov',
      'https://www.npmjs.com/package/@agentgov/sdk',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@agentgov.co',
      contactType: 'customer support',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SoftwareApplicationJsonLd(): React.JSX.Element {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AgentGov',
    description: 'AI Agent Governance Platform for monitoring and EU AI Act compliance',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    url: 'https://agentgov.co',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '99',
      priceCurrency: 'USD',
      offerCount: 4,
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'USD',
          description: 'For personal projects — 10K traces/month',
        },
        {
          '@type': 'Offer',
          name: 'Starter',
          price: '29',
          priceCurrency: 'USD',
          description: 'For small teams — 100K traces/month',
        },
        {
          '@type': 'Offer',
          name: 'Pro',
          price: '99',
          priceCurrency: 'USD',
          description: 'For growing companies — 500K traces/month',
        },
        {
          '@type': 'Offer',
          name: 'Enterprise',
          price: '0',
          priceCurrency: 'USD',
          description: 'Custom pricing — Unlimited traces',
        },
      ],
    },
    featureList: [
      'Real-time AI agent tracing',
      'EU AI Act risk classification',
      'Compliance documentation generation',
      'Cost and token tracking',
      'Team collaboration',
      'OpenAI and Anthropic integrations',
    ],
    softwareVersion: '0.1.0',
    author: {
      '@type': 'Organization',
      name: 'AgentGov',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function WebSiteJsonLd(): React.JSX.Element {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AgentGov',
    url: 'https://agentgov.co',
    description: 'AI Agent Governance Platform with real-time observability and EU AI Act compliance',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://agentgov.co/dashboard?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }): React.JSX.Element {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function FAQPageJsonLd(): React.JSX.Element {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is AgentGov?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AgentGov is an AI Agent Governance Platform that provides real-time observability and EU AI Act compliance for AI agents. It helps organizations monitor, secure, and govern their autonomous AI systems with features like tracing, risk classification, and compliance documentation.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is AgentGov free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, AgentGov offers a free beta tier with 100,000 traces per month, 10 projects, 5 team members, and full access to EU AI Act compliance features. Paid plans start at $29/month after the beta period.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is EU AI Act compliance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The EU AI Act is European regulation requiring AI systems to meet safety and transparency requirements. AgentGov helps organizations classify their AI systems by risk level (based on Annex III categories), generate required compliance documentation, track incidents, and configure human oversight.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which AI frameworks does AgentGov support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AgentGov supports OpenAI, Anthropic Claude, and Vercel AI SDK through the @agentgov/sdk npm package. The SDK provides wrapper functions that automatically trace all AI calls. Custom integrations are also supported via the REST API.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I get started with AgentGov?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sign up at agentgov.co, create a project to get an API key, then install the SDK with npm install @agentgov/sdk. Wrap your OpenAI or other AI client with ag.wrapOpenAI() and all calls will be automatically traced. Traces appear in your dashboard within seconds.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the difference between AgentGov and Langfuse?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'While both provide AI observability, AgentGov uniquely combines tracing with EU AI Act compliance features. AgentGov includes risk classification, compliance documentation generation, incident tracking, and human oversight configuration that Langfuse does not offer.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
