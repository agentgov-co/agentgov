"use client";

import React from "react";
import Link from "next/link";
import { useTraces, useDeleteTrace } from "@/hooks/use-traces";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Clock,
  Zap,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Trace } from "@/lib/api";

interface TracesListProps {
  projectId: string;
  highlightIds?: Set<string>;
  statusFilter?: string;
  searchQuery?: string;
}

export function TracesList({ projectId, highlightIds, statusFilter, searchQuery }: TracesListProps): React.JSX.Element {
  const { data, isLoading } = useTraces({
    projectId,
    limit: 50,
    status: statusFilter && statusFilter !== 'all' ? statusFilter.toUpperCase() as 'RUNNING' | 'COMPLETED' | 'FAILED' : undefined,
    search: searchQuery || undefined,
  });
  const deleteTrace = useDeleteTrace(projectId);

  if (isLoading) {
    return <ListSkeleton />;
  }

  const traces = data?.data || [];

  if (traces.length === 0) {
    return (
      <div className="text-center py-16 text-black/50">
        No traces found. Run your first agent to see traces here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {traces.map((trace) => (
        <TraceCard
          key={trace.id}
          trace={trace}
          isHighlighted={highlightIds?.has(trace.id)}
          onDelete={() => deleteTrace.mutate(trace.id)}
        />
      ))}
    </div>
  );
}

interface TraceCardProps {
  trace: Trace;
  isHighlighted?: boolean;
  onDelete: () => void;
}

function TraceCard({ trace, isHighlighted, onDelete }: TraceCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "bg-white border border-black/10 rounded-lg p-4 transition-all duration-500 hover:border-black/20 overflow-hidden",
        isHighlighted && "bg-green-50/80 border-green-200",
      )}
    >
      {/* Main content */}
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/dashboard/traces/${trace.id}`}
              className="font-medium text-black hover:text-black/70 transition-colors block truncate"
            >
              {trace.name || `Trace ${trace.id.slice(0, 8)}`}
            </Link>
            <p className="text-sm text-black/40 mt-0.5">
              {formatDistanceToNow(new Date(trace.startedAt), {
                addSuffix: true,
              })}
            </p>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-black/40 hover:text-black shrink-0"
                aria-label="Trace options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/traces/${trace.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => {
                  onDelete();
                  toast.success("Trace deleted");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-x-4 gap-y-2 mt-3 text-sm flex-wrap">
          <StatusBadge status={trace.status} />

          {trace.totalDuration != null && (
            <div className="flex items-center gap-1.5 text-black/50">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {trace.totalDuration >= 1000
                  ? `${(trace.totalDuration / 1000).toFixed(1)}s`
                  : `${trace.totalDuration}ms`}
              </span>
            </div>
          )}

          {trace.totalTokens != null && trace.totalTokens > 0 && (
            <div className="flex items-center gap-1.5 text-black/50">
              <Zap className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {trace.totalTokens.toLocaleString()}
              </span>
            </div>
          )}

          {trace.totalCost != null && trace.totalCost > 0 && (
            <div className="flex items-center gap-1.5 text-black/50">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="tabular-nums">{trace.totalCost.toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}
