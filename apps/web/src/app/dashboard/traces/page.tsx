'use client'

import { useState, useSyncExternalStore, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSelectedProject } from '@/hooks/use-selected-project'
import { useRealtime } from '@/hooks/use-realtime'
import { useDebounce } from '@/hooks/use-debounce'
import { TracesList } from '@/components/traces/traces-list'
import { TracesTable } from '@/components/traces/traces-table'
import { ConnectionStatus } from '@/components/realtime'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, FolderOpen, Radio, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const emptySubscribe = () => () => {}

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export default function TracesPage(): React.JSX.Element {
  const { selectedProjectId } = useSelectedProject()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const mounted = useIsMounted()

  // Track highlight timeouts for cleanup on unmount
  const highlightTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = highlightTimeoutsRef.current
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout))
      timeouts.clear()
    }
  }, [])

  const channels = useMemo((): ('traces' | 'spans')[] => ['traces'], [])

  const handleTraceCreated = useCallback((message: { data: { id: string } }) => {
    const traceId = message.data.id
    setHighlightIds((prev) => new Set(prev).add(traceId))

    // Clear any existing timeout for this trace
    const existingTimeout = highlightTimeoutsRef.current.get(traceId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout with cleanup tracking
    const timeout = setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev)
        next.delete(traceId)
        return next
      })
      highlightTimeoutsRef.current.delete(traceId)
    }, 5000)

    highlightTimeoutsRef.current.set(traceId, timeout)
  }, [])

  const { isConnected, connectionStatus } = useRealtime({
    projectId: selectedProjectId || undefined,
    channels,
    enabled: mounted && !!selectedProjectId,
    onTraceCreated: handleTraceCreated
  })

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-lg">Traces</h1>
              <p className="text-sm text-black/50">
                Monitor and analyze your agent executions
              </p>
            </div>
            {mounted && selectedProjectId && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <Radio className={`h-3 w-3 ${isConnected ? 'text-green-500' : 'text-black/30'}`} />
                  <span className={isConnected ? 'text-green-600' : 'text-black/40'}>
                    {isConnected ? 'Live' : 'Disconnected'}
                  </span>
                </div>
                <ConnectionStatus status={connectionStatus} />
              </div>
            )}
          </div>
        </div>

        {/* Filters row */}
        {mounted && selectedProjectId && (
          <div className="px-6 pb-4 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30" />
              <Input
                placeholder="Search traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 bg-black/[0.02] border-black/10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9 bg-black/[0.02] border-black/10">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 border border-black/10 rounded-lg p-0.5">
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('cards')}
                aria-label="Card view"
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('table')}
                aria-label="Table view"
                title="Table view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {selectedProjectId ? (
          viewMode === 'cards' ? (
            <TracesList
              projectId={selectedProjectId}
              highlightIds={highlightIds}
              statusFilter={statusFilter}
              searchQuery={debouncedSearch}
            />
          ) : (
            <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
              <TracesTable
                projectId={selectedProjectId}
                highlightIds={highlightIds}
                statusFilter={statusFilter}
                searchQuery={debouncedSearch}
              />
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg border border-black/10 p-16 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-black/20" />
            <h3 className="font-medium text-lg mb-2">No project selected</h3>
            <p className="text-black/50 mb-4">
              Select a project from the header to view traces.
            </p>
            <Button asChild>
              <Link href="/dashboard/projects">
                Go to Projects
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
