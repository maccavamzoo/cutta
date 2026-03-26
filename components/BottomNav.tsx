"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { key: "today",    href: "/dashboard", label: "Today",    icon: "◉" },
  { key: "calendar", href: "/calendar",  label: "Calendar", icon: "▦" },
  { key: "plan",     href: "/plan",      label: "Plan",     icon: "≡" },
  { key: "progress", href: "/progress",  label: "Progress", icon: "↗" },
] as const;

const MORE_ITEMS = [
  { label: "Shopping list",      href: "/shopping",         icon: "☑" },
  { label: "Log training",       href: "/training/upload",  icon: "⊕" },
  { label: "Record note",        href: "/audio",            icon: "◎" },
  { label: "Settings / Protocol", href: "/settings/protocol", icon: "⚙" },
];

type NavKey = (typeof NAV_ITEMS)[number]["key"] | "more";

export default function BottomNav({ active }: { active: NavKey }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();

  function handleMoreItem(href: string) {
    setMoreOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* Drop-up overlay backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Drop-up menu */}
      {moreOpen && (
        <div className="fixed bottom-[52px] left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="w-full max-w-lg px-4 pointer-events-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl mb-2">
              {MORE_ITEMS.map((item, i) => (
                <button
                  key={item.href}
                  onClick={() => handleMoreItem(item.href)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-zinc-200 active:bg-zinc-800 transition-colors ${
                    i > 0 ? "border-t border-zinc-800" : ""
                  }`}
                >
                  <span className="text-base w-5 text-center text-zinc-400">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur border-t border-zinc-800 z-40">
        <div className="flex max-w-lg mx-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                active === item.key
                  ? "text-lime-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
              active === "more" || moreOpen
                ? "text-lime-400"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <span className="text-base leading-none">···</span>
            <span className="font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
