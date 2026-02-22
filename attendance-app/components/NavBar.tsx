"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: "📊" },
  { href: "/attendance", label: "Attendance",  icon: "📋" },
  { href: "/employees",  label: "Employees",   icon: "👥" },
  { href: "/devices",    label: "Devices",     icon: "📡" },
  { href: "/settings",   label: "Settings",    icon: "⚙️"  },
];

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 fixed top-0 left-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-100">
        <span className="text-lg font-bold text-slate-900">Attendance</span>
        <p className="text-xs text-slate-400 mt-0.5">Management System</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={logout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                     text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <span>🚪</span> {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}

/** Thin top bar for mobile */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden flex items-center justify-around bg-white border-t border-slate-200
                    fixed bottom-0 left-0 right-0 z-10 h-14">
      {NAV.map(({ href, icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl transition-colors
              ${active ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}
          >
            {icon}
          </Link>
        );
      })}
    </nav>
  );
}
