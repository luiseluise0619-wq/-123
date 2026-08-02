"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Compass, MapPin, BarChart3, FileText, MessageSquare, Briefcase, Activity } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "상권 대시보드", icon: BarChart3 },
    { href: "/simulator", label: "AI 시뮬레이터", icon: Compass },
    { href: "/map", label: "기회 지도", icon: MapPin },
    { href: "/report", label: "AI 리포트", icon: FileText },
    { href: "/chat", label: "AI 컨설턴트", icon: MessageSquare },
    { href: "/workspace", label: "워크스페이스", icon: Briefcase },
    { href: "/admin/monitoring", label: "MLOps", icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/60 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              AI Local Intelligence
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-semibold tracking-wider text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full">
              SaaS v1.0
            </span>
          </div>
        </Link>

        {/* Navigation Routes */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* CTA Search Launcher */}
        <Link
          href="/"
          className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          무료 상권 분석
        </Link>
      </div>
    </header>
  );
}
