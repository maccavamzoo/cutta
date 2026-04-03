"use client";

import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { key: "today",    href: "/dashboard", label: "Today",    icon: "◉" },
  { key: "plan",     href: "/plan",      label: "Plan",     icon: "≡" },
  { key: "ai",       href: "/advisor",   label: "AI",       icon: "✦" },
  { key: "progress", href: "/progress",  label: "Progress", icon: "↗" },
  { key: "settings", href: "/settings",  label: "Settings", icon: "⚙" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"] | "calendar";

export default function BottomNav({
  active,
  onNavigate,
}: {
  active: NavKey;
  onNavigate?: (href: string) => boolean;
}) {
  const router = useRouter();

  function handleNavItem(href: string) {
    if (onNavigate && !onNavigate(href)) return;
    router.push(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur border-t border-zinc-800 z-40">
      <div className="flex max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => handleNavItem(item.href)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
              active === item.key ? "text-lime-400" : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
