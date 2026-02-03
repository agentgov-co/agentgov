import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      {/* Header skeleton */}
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <Skeleton className="h-7 w-24 mb-1" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        {/* Tabs skeleton */}
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>

        {/* Content skeleton */}
        <div className="max-w-2xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    </main>
  )
}
