import { Skeleton } from '@/components/ui/skeleton'

export default function TracesLoading(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      {/* Header skeleton */}
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <Skeleton className="h-7 w-32 mb-1" />
        <Skeleton className="h-5 w-48" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="bg-white rounded-lg border border-black/10 p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </main>
  )
}
