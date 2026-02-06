"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Check, LogOut, Menu, Sparkles, ShieldAlert } from "lucide-react";
import { Logo, LogoLoader } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { SelectedProjectContext } from "@/hooks/use-selected-project";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-provider";
import { HydrationFix } from "@/components/hydration-fix";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { UsageWarning } from "@/components/usage-warning";
import { FeedbackWidget } from "@/components/feedback-widget";
import { OnboardingModal } from "@/components/onboarding";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const tabs = [
  { name: "Overview", href: "/dashboard", exact: true },
  { name: "Traces", href: "/dashboard/traces" },
  { name: "Projects", href: "/dashboard/projects" },
  { name: "Compliance", href: "/dashboard/compliance" },
  { name: "Policies", href: "/dashboard/policies", disabled: true },
  { name: "Settings", href: "/dashboard/settings" },
];

export function DashboardLayoutClient({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    isLoading: isAuthLoading,
    isOrgLoading,
    isAuthenticated,
    organization,
    signOut,
  } = useAuth();
  const { data: projects } = useProjects();
  const [manuallySelectedId, setManuallySelectedId] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("selectedProjectId");
    },
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // All hooks must be called before any conditional returns
  const setSelectedProjectId = useCallback((id: string | null) => {
    setManuallySelectedId(id);
    if (id) {
      localStorage.setItem("selectedProjectId", id);
    } else {
      localStorage.removeItem("selectedProjectId");
    }
  }, []);

  // Validate that the stored project ID exists in projects list
  // If not, fall back to first project
  const selectedProjectId = useMemo(() => {
    if (
      manuallySelectedId &&
      projects?.some((p) => p.id === manuallySelectedId)
    ) {
      return manuallySelectedId;
    }
    return projects?.[0]?.id ?? null;
  }, [manuallySelectedId, projects]);

  const selectedProject = useMemo(
    () => projects?.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const contextValue = useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
    }),
    [selectedProjectId, setSelectedProjectId],
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Show loader only while checking auth (not when unauthenticated)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LogoLoader size={48} />
      </div>
    );
  }

  // Show loader while redirecting to login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LogoLoader size={48} />
      </div>
    );
  }

  // Check if user is privileged role (owner/admin) without 2FA enabled
  const isPrivilegedWithout2FA =
    (organization?.role === 'owner' || organization?.role === 'admin') &&
    user?.twoFactorEnabled === false;

  // Show loader while org is loading, or while projects are loading (org exists but data not yet fetched)
  if (isOrgLoading || (organization && !projects)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LogoLoader size={48} />
      </div>
    );
  }

  return (
    <SelectedProjectContext.Provider value={contextValue}>
      <HydrationFix nonce={nonce} />
      <div
        className="min-h-screen bg-neutral-50 flex flex-col"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      >
        {/* Header */}
        <header className="border-b border-black/10 bg-white sticky top-0 z-50">
          {/* Row 1: Logo + Project Selector + User */}
          <div className="flex items-center justify-between h-14 px-5 border-b border-black/5">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-9 w-9"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="border-b border-black/10 p-4">
                    <SheetTitle>
                      <Logo size="md" />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="p-4 space-y-4">
                    {/* Mobile Organization Switcher */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-black/50 uppercase tracking-wide">
                        Organization
                      </p>
                      <OrganizationSwitcher />
                    </div>

                    {/* Mobile Project Selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-black/50 uppercase tracking-wide">
                        Project
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-9 w-full justify-start"
                            suppressHydrationWarning
                            aria-label="Select project"
                          >
                            {selectedProject && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                            <span
                              className={cn(
                                "truncate",
                                selectedProject && "font-medium",
                              )}
                            >
                              {selectedProject?.name || "Select Project"}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-55">
                          {projects?.map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setMobileMenuOpen(false);
                              }}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate">{project.name}</span>
                              {project.id === selectedProjectId && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                          {(!projects || projects.length === 0) && (
                            <DropdownMenuItem disabled>
                              No projects yet
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            asChild
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Link
                              href="/dashboard/projects"
                              className="text-primary"
                            >
                              + Create Project
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Mobile Navigation */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-black/50 uppercase tracking-wide">
                        Navigation
                      </p>
                      <nav className="space-y-1">
                        {tabs.map((tab) => {
                          const isActive =
                            "exact" in tab && tab.exact
                              ? pathname === tab.href
                              : pathname.startsWith(tab.href);
                          return (
                            <Link
                              key={tab.href}
                              href={tab.disabled ? "#" : tab.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-black/5 text-black"
                                  : "text-black/60 hover:bg-black/3 hover:text-black/80",
                                tab.disabled && "opacity-40 cursor-not-allowed",
                              )}
                              onClick={(e) => {
                                if (tab.disabled) {
                                  e.preventDefault();
                                } else {
                                  setMobileMenuOpen(false);
                                }
                              }}
                            >
                              {tab.name}
                              {tab.disabled && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-black/5 text-black/40 font-normal">
                                  Soon
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Link href="/dashboard" className="flex items-center gap-2">
                <Logo size="md" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#7C3AED]/10 text-[#7C3AED] rounded-full">
                  <Sparkles className="h-3 w-3" />
                  Beta
                </span>
              </Link>

              {/* Organization Switcher - hidden on mobile */}
              <div className="hidden md:block">
                <OrganizationSwitcher />
              </div>

              {/* Project Selector - hidden on mobile */}
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-9"
                      suppressHydrationWarning
                      aria-label="Select project"
                    >
                      {selectedProject && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <span
                        className={cn(
                          "max-w-50 truncate",
                          selectedProject && "font-medium",
                        )}
                      >
                        {selectedProject?.name || "Select Project"}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-55">
                    {projects?.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className="flex items-center justify-between"
                      >
                        <span className="truncate">{project.name}</span>
                        {project.id === selectedProjectId && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    {(!projects || projects.length === 0) && (
                      <DropdownMenuItem disabled>
                        No projects yet
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/projects" className="text-primary">
                        + Create Project
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 gap-2 px-2"
                  suppressHydrationWarning
                >
                  <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                  <span className="text-sm font-medium max-w-30 truncate hidden sm:block">
                    {user?.name || "User"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings?tab=api-keys">API Keys</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 2: Tabs - hidden on mobile */}
          <nav className="hidden md:flex items-stretch gap-1 px-5 h-11">
            {tabs.map((tab) => {
              const isActive =
                "exact" in tab && tab.exact
                  ? pathname === tab.href
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.disabled ? "#" : tab.href}
                  className={cn(
                    "px-3 flex items-center text-sm font-medium transition-colors relative",
                    isActive
                      ? "text-black"
                      : "text-black/50 hover:text-black/70",
                    tab.disabled && "opacity-40 cursor-not-allowed",
                    isActive &&
                      "after:absolute after:-bottom-px after:left-0 after:right-0 after:h-0.5 after:bg-black",
                  )}
                  onClick={tab.disabled ? (e) => e.preventDefault() : undefined}
                >
                  {tab.name}
                  {tab.disabled && (
                    <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-black/5 text-black/40 font-normal">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Usage Warning Banner */}
        <UsageWarning />

        {/* 2FA Required Banner */}
        {isPrivilegedWithout2FA && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Two-factor authentication is required for your role. Please enable 2FA to access all features.
                </p>
              </div>
              <Link
                href="/dashboard/settings?tab=security"
                className="text-sm font-medium text-amber-700 hover:text-amber-900 underline"
              >
                Enable 2FA
              </Link>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex">{children}</div>

        {/* Feedback Widget */}
        <FeedbackWidget />

        {/* Onboarding Modal */}
        <OnboardingModal />
      </div>
    </SelectedProjectContext.Provider>
  );
}
