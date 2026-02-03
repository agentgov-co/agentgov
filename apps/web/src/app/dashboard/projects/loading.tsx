import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectsLoading(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      {/* Header skeleton */}
      <div className="bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-24 mb-1" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    </main>
  )
}
