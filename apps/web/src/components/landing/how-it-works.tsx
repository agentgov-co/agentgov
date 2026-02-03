"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Activity, Eye, Lock, Zap, BarChart3, Shield } from "lucide-react";

const steps = [
  {
    num: "1",
    title: "Install the SDK",
    desc: "Add AgentGov to your project with a single npm install command. Zero dependencies, minimal footprint.",
    icon: Zap,
  },
  {
    num: "2",
    title: "Wrap your AI client",
    desc: "Wrap your OpenAI or Vercel AI client with one line. No code changes to your existing logic.",
    icon: Lock,
  },
  {
    num: "3",
    title: "View traces in dashboard",
    desc: "See every LLM call, tool invocation, and agent step in real-time with cost tracking.",
    icon: Eye,
  },
  {
    num: "4",
    title: "Set up alerts and policies",
    desc: "Configure compliance rules, cost limits, and get notified when agents behave unexpectedly.",
    icon: Activity,
  },
];

// Different mockups for each step
function Step1Mockup(): React.JSX.Element {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-black/5 overflow-hidden w-full max-w-lg">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-4 bg-neutral-50 border-b border-black/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
        </div>
        <span className="text-xs sm:text-sm text-black/40 ml-2">Terminal</span>
      </div>
      <div className="p-4 sm:p-6 font-mono text-sm sm:text-base bg-gray-900 text-gray-100">
        <div className="text-green-400">$ npm install @agentgov/sdk</div>
        <div className="mt-2 sm:mt-3 text-gray-400">
          <div>added 1 package in 2s</div>
          <div className="mt-1 sm:mt-2">
            <span className="text-green-400">✓</span> @agentgov/sdk@1.0.0
          </div>
        </div>
        <div className="mt-4 sm:mt-6 text-green-400">$ _</div>
      </div>
    </div>
  );
}

function Step2Mockup(): React.JSX.Element {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-black/5 overflow-hidden w-full max-w-lg">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-4 bg-neutral-50 border-b border-black/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
        </div>
        <span className="text-xs sm:text-sm text-black/40 ml-2">index.ts</span>
      </div>
      <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm bg-gray-900 text-gray-100 leading-relaxed">
        <div>
          <span className="text-purple-400">import</span>
          <span className="text-gray-300">{" { AgentGov } "}</span>
          <span className="text-purple-400">from</span>
          <span className="text-green-400">{" '@agentgov/sdk'"}</span>
        </div>
        <div>
          <span className="text-purple-400">import</span>
          <span className="text-gray-300">{" OpenAI "}</span>
          <span className="text-purple-400">from</span>
          <span className="text-green-400">{" 'openai'"}</span>
        </div>
        <div className="mt-4">
          <span className="text-purple-400">const</span>
          <span className="text-gray-300">{" ag = "}</span>
          <span className="text-purple-400">new</span>
          <span className="text-blue-400">{" AgentGov"}</span>
          <span className="text-gray-300">{"()"}</span>
        </div>
        <div className="mt-2 bg-[#7C3AED]/20 -mx-6 px-6 py-2 border-l-2 border-[#7C3AED]">
          <span className="text-purple-400">const</span>
          <span className="text-gray-300">{" openai = ag."}</span>
          <span className="text-blue-400">wrapOpenAI</span>
          <span className="text-gray-300">{"("}</span>
          <span className="text-purple-400">new</span>
          <span className="text-blue-400">{" OpenAI"}</span>
          <span className="text-gray-300">{"())"}</span>
        </div>
        <div className="mt-4 text-gray-500">{"// That's it!"}</div>
      </div>
    </div>
  );
}

function Step3Mockup(): React.JSX.Element {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-black/5 overflow-hidden w-full max-w-lg">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-4 bg-neutral-50 border-b border-black/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
        </div>
        <span className="text-xs sm:text-sm text-black/40 ml-2">Trace Details</span>
      </div>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium">Trace #a8f3k2</span>
          <span className="text-sm px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full">
            Completed
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
            <Activity className="w-5 h-5 text-[#7C3AED]" />
            <span className="font-medium">agent_run</span>
            <span className="text-sm text-black/40 ml-auto">3.2s</span>
          </div>
          <div className="flex items-center gap-3 p-3 ml-6 bg-neutral-50 rounded-lg">
            <Zap className="w-5 h-5 text-purple-500" />
            <span>llm_call</span>
            <span className="text-sm text-black/40 ml-auto">1.8s</span>
          </div>
          <div className="flex items-center gap-3 p-3 ml-6 bg-neutral-50 rounded-lg">
            <Eye className="w-5 h-5 text-orange-500" />
            <span>tool_call</span>
            <span className="text-sm text-black/40 ml-auto">0.9s</span>
          </div>
        </div>
        <div className="pt-4 border-t border-black/5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-black/40">Tokens</div>
              <div className="text-lg font-semibold">2,847</div>
            </div>
            <div>
              <div className="text-sm text-black/40">Cost</div>
              <div className="text-lg font-semibold">$0.042</div>
            </div>
            <div>
              <div className="text-sm text-black/40">Duration</div>
              <div className="text-lg font-semibold">3.2s</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4Mockup(): React.JSX.Element {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-black/5 overflow-hidden w-full max-w-lg">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-4 bg-neutral-50 border-b border-black/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
          <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-black/10" />
        </div>
        <span className="text-xs sm:text-sm text-black/40 ml-2">Policies</span>
      </div>
      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
          <Shield className="w-6 h-6 text-[#7C3AED]" />
          <div className="flex-1">
            <div className="font-medium">Cost Limit</div>
            <div className="text-sm text-black/40">Max $10/day per agent</div>
          </div>
          <div className="w-12 h-6 bg-[#7C3AED] rounded-full relative">
            <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
          <BarChart3 className="w-6 h-6 text-emerald-500" />
          <div className="flex-1">
            <div className="font-medium">EU AI Act Compliance</div>
            <div className="text-sm text-black/40">Audit logging enabled</div>
          </div>
          <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
            <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
          <Activity className="w-6 h-6 text-orange-500" />
          <div className="flex-1">
            <div className="font-medium">Error Alerts</div>
            <div className="text-sm text-black/40">Slack notifications</div>
          </div>
          <div className="w-12 h-6 bg-orange-500 rounded-full relative">
            <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

const mockups = [Step1Mockup, Step2Mockup, Step3Mockup, Step4Mockup];

const AUTO_SWITCH_INTERVAL = 4000; // 4 seconds

export function HowItWorks(): React.JSX.Element {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const ActiveMockup = mockups[activeStep];

  const goToNextStep = useCallback(() => {
    setActiveStep((prev) => (prev + 1) % steps.length);
    setProgress(0);
  }, []);

  // Auto-switch effect
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(goToNextStep, AUTO_SWITCH_INTERVAL);
    return () => clearInterval(interval);
  }, [isPaused, goToNextStep]);

  // Progress bar effect
  useEffect(() => {
    if (isPaused) {
      return;
    }

    let animationId: number;
    const startTime = Date.now();

    const animate = (): void => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / AUTO_SWITCH_INTERVAL) * 100, 100);
      setProgress(newProgress);
      if (newProgress < 100) {
        animationId = requestAnimationFrame(animate);
      }
    };

    // Start animation on next frame
    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [activeStep, isPaused]);

  const handleStepClick = (index: number): void => {
    setActiveStep(index);
    setProgress(0);
    setIsPaused(true);
    // Resume auto-switching after 10 seconds of inactivity
    setTimeout(() => setIsPaused(false), 10000);
  };

  return (
    <div className="grid lg:grid-cols-2">
      {/* Left: Steps list with horizontal dividers */}
      <div className="lg:border-r border-black/10">
        {steps.map((step, i) => (
          <button
            key={step.num}
            onClick={() => handleStepClick(i)}
            className={`relative w-full flex gap-3 sm:gap-4 p-4 sm:p-6 text-left transition-all ${
              i < steps.length - 1 ? "border-b border-black/10" : ""
            } ${
              activeStep === i
                ? "bg-[#7C3AED]/5"
                : "hover:bg-black/[0.02]"
            }`}
          >
            {/* Left border with progress */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-black/10">
              {activeStep === i && (
                <div
                  className="w-full bg-[#7C3AED] transition-none"
                  style={{ height: `${isPaused ? 100 : progress}%` }}
                />
              )}
            </div>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                activeStep === i ? "bg-[#7C3AED] text-white" : "bg-[#7C3AED]/10"
              }`}
            >
              <step.icon
                className={`w-4 h-4 ${activeStep === i ? "text-white" : "text-[#7C3AED]"}`}
              />
            </div>
            <div className="overflow-hidden flex-1">
              <h3 className="font-medium mb-1">
                {step.num}. {step.title}
              </h3>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  activeStep === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <p className="text-sm text-black/50 leading-relaxed overflow-hidden">
                  {step.desc}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Right: Mockup with dotted grid background */}
      <div
        className="p-4 sm:p-8 lg:p-16 flex items-center justify-center min-h-[350px] sm:min-h-[400px] lg:min-h-[500px] bg-neutral-50"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      >
        <div
          key={activeStep}
          className="animate-fade-in-up"
          style={{ animationDuration: "0.4s" }}
        >
          <ActiveMockup />
        </div>
      </div>
    </div>
  );
}
