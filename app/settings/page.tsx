import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import SettingsView from "./SettingsView";
import type { UnitSystem } from "@/lib/units";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile] = await db
    .select({ unitSystem: userProfiles.unitSystem })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  const unitSystem: UnitSystem =
    (profile?.unitSystem as UnitSystem | undefined) ?? "metric";

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto space-y-8 pb-24">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-zinc-500 text-sm">App preferences and configuration.</p>
        </div>

        {/* Unit system */}
        <SettingsView unitSystem={unitSystem} />

        {/* Protocol */}
        {/* Profile */}
        <div className="space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Profile</p>
          <Link
            href="/settings/profile"
            className="flex items-center justify-between px-4 py-3.5 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div>
              <p className="text-white text-sm font-medium">Edit profile</p>
              <p className="text-zinc-600 text-xs mt-0.5">Target weight, training habits, food exclusions, gut sensitivity</p>
            </div>
            <span className="text-zinc-500 text-sm">→</span>
          </Link>
        </div>

        {/* Protocol */}
        <div className="space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Protocol</p>
          <Link
            href="/settings/protocol"
            className="flex items-center justify-between px-4 py-3.5 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div>
              <p className="text-white text-sm font-medium">Fuelling protocol</p>
              <p className="text-zinc-600 text-xs mt-0.5">View or update your fuelling protocol</p>
            </div>
            <span className="text-zinc-500 text-sm">→</span>
          </Link>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Quick actions</p>
          {[
            { href: "/shopping",        label: "Shopping",      sub: "Weekly ingredient pool and shopping list" },
            { href: "/training/upload", label: "Log training",  sub: "Upload a screenshot or enter manually" },
            { href: "/audio",           label: "Record note",   sub: "Voice note — food reactions, observations" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div>
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-zinc-600 text-xs mt-0.5">{item.sub}</p>
              </div>
              <span className="text-zinc-500 text-sm">→</span>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav active="settings" />
    </>
  );
}
