'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTraces, useDeleteTrace } from '@/hooks/use-traces'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, ArrowUpDown, ExternalLink, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Trace } from '@/lib/api'

interface TracesTableProps {
  projectId: string
  highlightIds?: Set<string>
  statusFilter?: string
  searchQuery?: string
}

export function TracesTable({ projectId, highlightIds, statusFilter, searchQuery }: TracesTableProps): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'startedAt', desc: true }])
  const { data, isLoading } = useTraces({
    projectId,
    limit: 50,
    status: statusFilter && statusFilter !== 'all' ? statusFilter.toUpperCase() as 'RUNNING' | 'COMPLETED' | 'FAILED' : undefined,
    search: searchQuery || undefined,
  })
  const deleteTrace = useDeleteTrace(projectId)

  const columns: ColumnDef<Trace>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="h-3.5 w-3.5 text-black/30" />
        </button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/traces/${row.original.id}`}
          className="font-medium text-black hover:text-black/70 transition-colors"
        >
          {row.original.name || `Trace ${row.original.id.slice(0, 8)}`}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'totalTokens',
      header: 'Tokens',
      meta: { className: 'hidden lg:table-cell' },
      cell: ({ row }) => (
        <span className="tabular-nums text-black/70">
          {row.original.totalTokens?.toLocaleString() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'totalCost',
      header: 'Cost',
      meta: { className: 'hidden lg:table-cell' },
      cell: ({ row }) => (
        <span className="tabular-nums text-black/70">
          {row.original.totalCost
            ? `$${row.original.totalCost.toFixed(4)}`
            : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'totalDuration',
      header: 'Duration',
      meta: { className: 'hidden md:table-cell' },
      cell: ({ row }) => (
        <span className="tabular-nums text-black/70">
          {row.original.totalDuration
            ? `${(row.original.totalDuration / 1000).toFixed(2)}s`
            : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'startedAt',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-black transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Started
          <ArrowUpDown className="h-3.5 w-3.5 text-black/30" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-black/50 text-sm">
          {formatDistanceToNow(new Date(row.original.startedAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-black/40 hover:text-black" aria-label="Trace options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/traces/${row.original.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => {
                deleteTrace.mutate(row.original.id)
                toast.success('Trace deleted')
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  if (isLoading) {
    return <TableSkeleton />
  }

  const hasData = table.getRowModel().rows?.length > 0

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-black/[0.02] hover:bg-black/[0.02]">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "text-black/60 font-medium text-xs uppercase tracking-wide h-11",
                    (header.column.columnDef.meta as { className?: string })?.className
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {hasData ? (
            table.getRowModel().rows.map((row) => {
              const isHighlighted = highlightIds?.has(row.original.id)
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    'transition-all duration-500 hover:bg-black/[0.02]',
                    isHighlighted && 'bg-green-50/80'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-3.5",
                        (cell.column.columnDef.meta as { className?: string })?.className
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-black/50"
              >
                No traces found. Run your first agent to see traces here.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {hasData && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-black/10">
          <p className="text-sm text-black/50">
            Showing {table.getRowModel().rows.length} of {data?.pagination.total || 0} traces
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 px-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TableSkeleton(): React.JSX.Element {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-10 w-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
