import Link from "next/link";

const NAV_ITEMS = [
  { key: "today",    href: "/dashboard",       label: "Today",    icon: "◉" },
  { key: "calendar", href: "/calendar",        label: "Calendar", icon: "▦" },
  { key: "plan",     href: "/plan",            label: "Plan",     icon: "≡" },
  { key: "notes",    href: "/audio",           label: "Notes",    icon: "◎" },
  { key: "log",      href: "/training/upload", label: "Log",      icon: "↑" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

export default function BottomNav({ active }: { active: NavKey }) {
  return (
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
      </div>
    </nav>
  );
}
