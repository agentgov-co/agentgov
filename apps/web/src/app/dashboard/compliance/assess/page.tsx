'use client'

import Link from 'next/link'
import { AssessmentWizard } from '@/components/compliance/assessment-wizard'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export default function AssessPage(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard/compliance">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-semibold text-lg">EU AI Act Assessment</h1>
            <p className="text-sm text-black/50">
              Classify your AI system and determine compliance requirements
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AssessmentWizard />
      </div>
    </main>
  )
}
