"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useTrace } from "@/hooks/use-traces";
import { useIsDesktop } from "@/hooks/use-mobile";
import { SpanTree } from "@/components/traces/span-tree";
import { TraceTimeline } from "@/components/traces/trace-timeline";
import { SpanDetails, SpanDetailsEmpty } from "@/components/traces/span-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Span } from "@/lib/api";
import {
  ArrowLeft,
  Clock,
  DollarSign,
  Zap,
  Layers,
  ListTree,
  GanttChart,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type ViewMode = "timeline" | "tree";

interface TracePageProps {
  params: Promise<{ id: string }>;
}

export default function TracePage({ params }: TracePageProps): React.JSX.Element {
  const { id } = use(params);
  const { data: trace, isLoading } = useTrace(id);
  const isDesktop = useIsDesktop();

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  // Calculate trace timing
  const { traceStartTime, traceDuration } = useMemo(() => {
    if (!trace?.spans?.length) {
      return { traceStartTime: 0, traceDuration: 0 };
    }

    const startTime = new Date(trace.startedAt).getTime();
    const endTime = trace.endedAt
      ? new Date(trace.endedAt).getTime()
      : Math.max(
          ...trace.spans.map((s) =>
            s.endedAt
              ? new Date(s.endedAt).getTime()
              : new Date(s.startedAt).getTime() + (s.duration || 0)
          )
        );

    return {
      traceStartTime: startTime,
      traceDuration: Math.max(endTime - startTime, 1),
    };
  }, [trace]);

  if (isLoading) {
    return <TraceDetailSkeleton />;
  }

  if (!trace) {
    return (
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-black/10 px-6 py-4">
          <h1 className="font-semibold text-lg">Trace not found</h1>
        </div>
        <div className="p-6">
          <div className="bg-white rounded-lg border border-black/10 p-16 text-center max-w-2xl">
            <h3 className="font-medium text-lg mb-2">Trace not found</h3>
            <p className="text-black/50 mb-4">
              The trace you&apos;re looking for doesn&apos;t exist or you
              don&apos;t have access.
            </p>
            <Button asChild>
              <Link href="/dashboard/traces">Back to traces</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-black/10 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Link href="/dashboard/traces">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <h1 className="font-semibold text-base md:text-lg truncate">
                  {trace.name || `Trace ${trace.id.slice(0, 8)}`}
                </h1>
                <StatusBadge status={trace.status} />
              </div>
              <p className="text-sm text-black/50 hidden sm:block">
                Started{" "}
                {formatDistanceToNow(new Date(trace.startedAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          {/* Metrics summary - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-black/60">
              <Clock className="h-4 w-4" />
              <span className="font-medium tabular-nums">
                {trace.totalDuration
                  ? `${(trace.totalDuration / 1000).toFixed(2)}s`
                  : "-"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-black/60">
              <Zap className="h-4 w-4" />
              <span className="font-medium tabular-nums">
                {trace.totalTokens?.toLocaleString() || "-"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-black/60">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium tabular-nums">
                {trace.totalCost ? `$${trace.totalCost.toFixed(4)}` : "-"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-black/60">
              <Layers className="h-4 w-4" />
              <span className="font-medium">{trace.spans?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - Timeline/Tree view */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          isDesktop && "border-r border-black/10"
        )}>
          {/* View toggle */}
          <div className="shrink-0 px-4 py-3 bg-white border-b border-black/10 flex items-center justify-between">
            <span className="text-sm font-medium text-black/70">
              Spans ({trace.spans?.length || 0})
            </span>
            <div className="flex items-center gap-1 p-1 bg-black/5 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2.5 md:px-3 gap-1.5",
                  viewMode === "timeline" && "bg-white shadow-sm"
                )}
                onClick={() => setViewMode("timeline")}
              >
                <GanttChart className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">Timeline</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2.5 md:px-3 gap-1.5",
                  viewMode === "tree" && "bg-white shadow-sm"
                )}
                onClick={() => setViewMode("tree")}
              >
                <ListTree className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">Tree</span>
              </Button>
            </div>
          </div>

          {/* Spans view */}
          <div className="flex-1 overflow-auto p-3 md:p-4 bg-black/[0.02]">
            {trace.spans && trace.spans.length > 0 ? (
              viewMode === "timeline" ? (
                <Card className="bg-white">
                  <CardContent className="p-3 md:p-4">
                    <TraceTimeline
                      spans={trace.spans}
                      selectedSpanId={selectedSpan?.id || null}
                      onSelectSpan={setSelectedSpan}
                      traceStartTime={traceStartTime}
                      traceDuration={traceDuration}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-white">
                  <CardContent className="p-3 md:p-4">
                    <SpanTree
                      spans={trace.spans}
                      selectedSpanId={selectedSpan?.id}
                      onSelectSpan={setSelectedSpan}
                    />
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-black/50">
                No spans recorded
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Span details (desktop only) */}
        {isDesktop && (
          <div className="w-96 shrink-0">
            {selectedSpan ? (
              <SpanDetails
                span={selectedSpan}
                onClose={() => setSelectedSpan(null)}
              />
            ) : (
              <SpanDetailsEmpty />
            )}
          </div>
        )}
      </div>

      {/* Mobile Sheet for Span Details */}
      {!isDesktop && (
        <Sheet
          open={!!selectedSpan}
          onOpenChange={(open) => !open && setSelectedSpan(null)}
        >
          <SheetContent
            side="bottom"
            className="h-[75vh] p-0 rounded-t-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-black/10 rounded-full" />
            </div>

            <SheetHeader className="sr-only">
              <SheetTitle>Span Details</SheetTitle>
              <SheetDescription>Details for the selected span</SheetDescription>
            </SheetHeader>

            {selectedSpan && (
              <div className="h-full overflow-auto">
                <SpanDetails
                  span={selectedSpan}
                  onClose={() => setSelectedSpan(null)}
                  hideCloseButton
                />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </main>
  );
}

function TraceDetailSkeleton(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      <div className="bg-white border-b border-black/10 px-4 md:px-6 py-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 hidden sm:block" />
          </div>
        </div>
      </div>
      <div className="flex h-[calc(100vh-120px)]">
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="w-96 border-l border-black/10 p-4 hidden lg:block">
          <Skeleton className="h-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
