"use client";

import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

const feedbackTypes = [
  { value: "BUG", label: "Bug" },
  { value: "FEATURE", label: "Feature" },
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "OTHER", label: "Other" },
] as const;

export function FeedbackWidget(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("OTHER");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pathname = usePathname();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim(), page: pathname }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setOpen(false);
          setSubmitted(false);
          setMessage("");
          setType("OTHER");
        }, 1500);
      }
    } catch {
      // silently fail for now
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-80 bg-white rounded-xl shadow-2xl border border-black/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <span className="text-sm font-medium">Send Feedback</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-black/5 rounded transition-colors"
              aria-label="Close feedback"
            >
              <X className="h-4 w-4 text-black/40" />
            </button>
          </div>

          {submitted ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-emerald-600">Thank you for your feedback!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="flex gap-1.5">
                {feedbackTypes.map((ft) => (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setType(ft.value)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      type === ft.value
                        ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                        : "border-black/15 text-black/60 hover:border-black/30"
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                rows={3}
                maxLength={5000}
                className="w-full px-3 py-2 text-sm border border-black/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]/50"
              />

              <Button
                type="submit"
                disabled={!message.trim() || submitting}
                className="w-full gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                size="sm"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? "Sending..." : "Send Feedback"}
              </Button>
            </form>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="ml-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#7C3AED] text-white shadow-lg hover:bg-[#7C3AED]/90 transition-colors"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>
    </div>
  );
}
