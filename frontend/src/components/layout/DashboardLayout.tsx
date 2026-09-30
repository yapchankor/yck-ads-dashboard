"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Target, Settings, Activity, Search, TrendingUp, Menu, X } from "lucide-react";
import React from "react";
import { UserButton } from "@clerk/nextjs";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getActiveClient } from "@/lib/client-config";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Google Ads", href: "/google", icon: Target },
  { name: "Meta Ads", href: "/meta", icon: Megaphone },
  { name: "Recommendations", href: "/recommendations", icon: Activity },
  { name: "Outcome Tracking", href: "/tracking", icon: TrendingUp },
  { name: "Settings", href: "/settings", icon: Settings },
];

function Logo({ dark }: { dark: boolean }) {
  const { logo } = getActiveClient().brand;
  if (dark) {
    return (
      <div className="flex items-center gap-2.5 px-4 mb-8">
        {logo.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.image} alt={logo.title} className="h-8 w-8 shrink-0" />
        )}
        <div className="leading-none">
          <h1 className="text-lg font-black text-white tracking-tight">{logo.title}</h1>
          {logo.subtitle && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mt-0.5">{logo.subtitle}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center px-4 mb-8">
      <h1 className="text-lg font-black leading-tight text-accent-primary tracking-tight">{logo.title}</h1>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const dark = getActiveClient().brand.sidebarVariant === "dark";

  return (
    <div className={cn(
      "flex h-full w-65 flex-col z-10 py-6 px-4",
      dark ? "bg-sidebar" : "bg-surface border-r border-border/50"
    )}>

      <Logo dark={dark} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center rounded-xl px-4 py-3 text-sm font-bold transition-all",
                  dark
                    ? (isActive
                        ? "bg-accent-orange text-sidebar"
                        : "text-white/65 hover:bg-sidebar-hover hover:text-white")
                    : (isActive
                        ? "bg-accent-lime text-accent-primary"
                        : "text-text-muted hover:bg-surface-hover hover:text-foreground")
                )}
              >
                <Icon className={cn(
                  "mr-3 h-5 w-5 shrink-0",
                  dark
                    ? (isActive ? "text-sidebar" : "text-white/55 group-hover:text-white")
                    : (isActive ? "text-accent-primary" : "text-text-muted group-hover:text-foreground")
                )} aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profile Card (Bottom) */}
      <div className="mt-auto px-2 pt-4">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center justify-between w-full p-2 rounded-xl transition-colors group",
            dark ? "hover:bg-sidebar-hover" : "hover:bg-surface-hover"
          )}
        >
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="text-left overflow-hidden">
              <p className={cn(
                "text-sm font-bold truncate transition-colors",
                dark ? "text-white" : "text-foreground group-hover:text-accent-primary"
              )}>Account Settings</p>
              <p className={cn(
                "text-[10px] font-medium truncate",
                dark ? "text-white/50" : "text-text-muted"
              )}>Manage profile</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { logo, sidebarVariant } = getActiveClient().brand;
  const dark = sidebarVariant === "dark";

  if (dark) {
    return (
      <header className="flex h-16 shrink-0 items-center justify-between bg-background px-4 lg:h-20 lg:px-8">
        {/* Left: Menu (mobile) + Search Bar (desktop) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border/40 text-foreground shadow-sm lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile brand (sidebar is hidden on small screens) */}
          <div className="flex items-center gap-2 lg:hidden">
            {logo.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.image} alt={logo.title} className="h-7 w-7 shrink-0" />
            )}
            <span className="text-base font-black tracking-tight text-foreground">{logo.title}</span>
          </div>

          {/* Desktop search */}
          <div className="relative hidden w-72 lg:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="w-4 h-4 text-text-muted" />
            </div>
            <input type="text" placeholder="Search..." className="h-10 w-full rounded-full bg-surface border border-border/40 pl-9 pr-12 text-sm focus:outline-none focus:border-accent-primary shadow-sm" disabled />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1">
              <span className="text-[10px] font-bold text-text-muted">⌘</span>
              <span className="text-[10px] font-bold text-text-muted">K</span>
            </div>
          </div>
        </div>

        {/* Right: Account */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <UserButton />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-20 shrink-0 items-center justify-between bg-background px-8">
      {/* Left: Search Bar */}
      <div className="flex items-center gap-4">
         <div className="relative w-72">
           <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
             <Search className="w-4 h-4 text-text-muted" />
           </div>
           <input type="text" placeholder="Search..." className="h-10 w-full rounded-full bg-surface border border-border/40 pl-9 pr-12 text-sm focus:outline-none focus:border-accent-primary shadow-sm" disabled />
           <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1">
             <span className="text-[10px] font-bold text-text-muted">⌘</span>
             <span className="text-[10px] font-bold text-text-muted">K</span>
           </div>
         </div>
      </div>

      {/* Right: Account */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <UserButton />
        </div>
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = React.useState(false);
  const dark = getActiveClient().brand.sidebarVariant === "dark";

  if (dark) {
    return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        {/* Mobile off-canvas drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-0 top-0 h-full shadow-2xl">
              <Sidebar onNavigate={() => setNavOpen(false)} />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation menu"
                className="absolute right-3 top-6 flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-sidebar-hover hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden relative">
          <Header onMenuClick={() => setNavOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 pt-0 lg:p-8 lg:pt-0">
            <div className="max-w-350 mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 pt-0">
          <div className="max-w-350 mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
