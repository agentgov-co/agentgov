'use client'

import { useState } from 'react'
import { Activity, FolderKanban, Users, Clock, Sparkles, CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { useUsage, formatLimit } from '@/hooks/use-usage'
import { useCreateCheckout, useCreatePortal, getUpgradeUrls } from '@/hooks/use-billing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Progress bar component for usage display
 */
function UsageProgress({
  current,
  max,
  percentage,
  label,
}: {
  current: number
  max: number
  percentage: number
  label: string
}): React.JSX.Element {
  const isUnlimited = max === -1
  const isWarning = percentage >= 80 && percentage < 100
  const isError = percentage >= 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-black/60">{label}</span>
        <span className="font-medium">
          {current.toLocaleString()} / {formatLimit(max)}
        </span>
      </div>
      <div className="h-2 bg-black/5 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isUnlimited ? 'bg-green-500' :
            isError ? 'bg-red-500' :
            isWarning ? 'bg-amber-500' :
            'bg-primary'
          )}
          style={{ width: isUnlimited ? '5%' : `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {!isUnlimited && (
        <div className="text-xs text-black/40">
          {percentage}% used
          {isWarning && ' - approaching limit'}
          {isError && ' - limit reached'}
        </div>
      )}
    </div>
  )
}

/**
 * Card component for displaying a single limit
 */
function LimitCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: string | number
  description: string
}): React.JSX.Element {
  return (
    <div className="bg-white rounded-lg border border-black/10 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-1.5 bg-black/5 rounded">
          <Icon className="h-4 w-4 text-black/60" />
        </div>
        <span className="text-sm text-black/60">{title}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-black/40 mt-1">{description}</div>
    </div>
  )
}

/**
 * Plan badge component
 */
function PlanBadge({ tier, billingEnabled }: { tier: string; billingEnabled: boolean }): React.JSX.Element {
  const tierLabels: Record<string, string> = {
    FREE_BETA: 'Free Beta',
    FREE: 'Free',
    STARTER: 'Starter',
    PRO: 'Pro',
    ENTERPRISE: 'Enterprise',
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-sm py-1 px-3">
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        {tierLabels[tier] || tier}
      </Badge>
      {!billingEnabled && (
        <Badge variant="outline" className="text-xs">
          Beta Period
        </Badge>
      )}
    </div>
  )
}

/**
 * Plan card for upgrade selection
 */
function PlanCard({
  name,
  price,
  features,
  isCurrentPlan,
  isPopular,
  onSelect,
  isLoading,
}: {
  name: string
  price: string
  features: string[]
  isCurrentPlan: boolean
  isPopular?: boolean
  onSelect: () => void
  isLoading: boolean
}): React.JSX.Element {
  return (
    <div className={cn(
      'relative bg-white rounded-lg border p-5',
      isPopular ? 'border-primary shadow-md' : 'border-black/10',
      isCurrentPlan && 'ring-2 ring-primary/20'
    )}>
      {isPopular && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          Most Popular
        </Badge>
      )}
      <div className="mb-4">
        <h4 className="font-semibold">{name}</h4>
        <div className="text-2xl font-bold mt-1">{price}</div>
      </div>
      <ul className="space-y-2 mb-5 text-sm">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        onClick={onSelect}
        disabled={isCurrentPlan || isLoading}
        variant={isPopular ? 'default' : 'outline'}
        className="w-full"
      >
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {isCurrentPlan ? 'Current Plan' : 'Upgrade'}
      </Button>
    </div>
  )
}

export function UsageSettings(): React.JSX.Element {
  const { data: usage, isLoading, error, isFetching } = useUsage()
  const createCheckout = useCreateCheckout()
  const createPortal = useCreatePortal()
  const [showPlans, setShowPlans] = useState(false)

  // Check if we're waiting for organization (query is disabled)
  const isWaitingForOrg = !isLoading && !isFetching && !error && !usage

  const handleUpgrade = (tier: 'STARTER' | 'PRO' | 'ENTERPRISE'): void => {
    const urls = getUpgradeUrls()
    createCheckout.mutate({
      tier,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    })
  }

  const handleManageBilling = (): void => {
    const urls = getUpgradeUrls()
    createPortal.mutate(urls.returnUrl)
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (isWaitingForOrg) {
    return (
      <div className="max-w-2xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
          <p className="font-medium mb-1">No organization selected</p>
          <p className="text-sm">Please select or create an organization to view usage data.</p>
        </div>
      </div>
    )
  }

  if (error || !usage) {
    return (
      <div className="max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load usage data. Please try again later.
        </div>
      </div>
    )
  }

  // Format period dates
  const periodStart = new Date(usage.periodStart).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const periodEnd = new Date(usage.periodEnd).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const isPaidPlan = ['STARTER', 'PRO', 'ENTERPRISE'].includes(usage.tier)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Current Plan */}
      <div className="bg-white rounded-lg border border-black/10 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-black/5 rounded-lg">
              <Activity className="h-5 w-5 text-black/60" />
            </div>
            <div>
              <h2 className="font-medium">Usage & Limits</h2>
              <p className="text-sm text-black/50">
                Current billing period: {periodStart} - {periodEnd}
              </p>
            </div>
          </div>
          <PlanBadge tier={usage.tier} billingEnabled={usage.billingEnabled} />
        </div>

        {/* Traces Usage */}
        <UsageProgress
          current={usage.tracesCount}
          max={usage.tracesLimit}
          percentage={usage.tracesPercentage}
          label="Monthly Traces"
        />
      </div>

      {/* Limits Grid */}
      <div className="grid grid-cols-2 gap-4">
        <LimitCard
          icon={FolderKanban}
          title="Projects"
          value={`${usage.projectsCount} / ${formatLimit(usage.projectsLimit)}`}
          description="Active projects in your workspace"
        />
        <LimitCard
          icon={Users}
          title="Team Members"
          value={`${usage.membersCount} / ${formatLimit(usage.membersLimit)}`}
          description="Members in your organization"
        />
        <LimitCard
          icon={Clock}
          title="Data Retention"
          value={`${usage.retentionDays} days`}
          description="How long trace data is stored"
        />
        <LimitCard
          icon={Activity}
          title="Status"
          value={usage.status === 'ACTIVE' ? 'Active' : usage.status}
          description="Your subscription status"
        />
      </div>

      {/* Billing Actions / Upgrade CTA */}
      {usage.billingEnabled ? (
        <>
          {/* Manage Billing (for paid plans) */}
          {isPaidPlan && (
            <div className="bg-white rounded-lg border border-black/10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black/5 rounded-lg">
                    <CreditCard className="h-5 w-5 text-black/60" />
                  </div>
                  <div>
                    <h3 className="font-medium">Billing & Subscription</h3>
                    <p className="text-sm text-black/50">
                      Manage your payment method and subscription
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={createPortal.isPending}
                >
                  {createPortal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Manage Billing
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Upgrade CTA */}
          {!isPaidPlan && (
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 p-6">
              <h3 className="font-medium mb-2">Need more capacity?</h3>
              <p className="text-sm text-black/60 mb-4">
                Upgrade your plan to get more traces, projects, team members, and longer data retention.
              </p>
              <Button onClick={() => setShowPlans(!showPlans)}>
                {showPlans ? 'Hide Plans' : 'View Plans'}
              </Button>
            </div>
          )}

          {/* Plan Selection */}
          {showPlans && !isPaidPlan && (
            <div className="grid grid-cols-3 gap-4">
              <PlanCard
                name="Starter"
                price="$29/mo"
                features={[
                  '50,000 traces/month',
                  '5 projects',
                  '10 team members',
                  '30-day retention',
                  'Email support',
                ]}
                isCurrentPlan={usage.tier === 'STARTER'}
                onSelect={() => handleUpgrade('STARTER')}
                isLoading={createCheckout.isPending}
              />
              <PlanCard
                name="Pro"
                price="$99/mo"
                features={[
                  '500,000 traces/month',
                  '20 projects',
                  '50 team members',
                  '90-day retention',
                  'Priority support',
                  'SSO',
                ]}
                isCurrentPlan={usage.tier === 'PRO'}
                isPopular
                onSelect={() => handleUpgrade('PRO')}
                isLoading={createCheckout.isPending}
              />
              <PlanCard
                name="Enterprise"
                price="Custom"
                features={[
                  'Unlimited traces',
                  'Unlimited projects',
                  'Unlimited members',
                  '1-year retention',
                  'Dedicated support',
                  'Audit logs',
                ]}
                isCurrentPlan={usage.tier === 'ENTERPRISE'}
                onSelect={() => handleUpgrade('ENTERPRISE')}
                isLoading={createCheckout.isPending}
              />
            </div>
          )}
        </>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Free Beta Access</h3>
              <p className="text-sm text-blue-700">
                You&apos;re enjoying enhanced limits during our beta period. Thank you for being an early adopter!
                We&apos;ll notify you before any changes to your plan.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
