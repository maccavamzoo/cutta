import BottomNav from "@/components/BottomNav";

export default function DashboardLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-5 animate-pulse">
          {/* Header */}
          <div className="space-y-2 pt-1">
            <div className="h-3 w-24 bg-zinc-800 rounded-full" />
            <div className="h-7 w-52 bg-zinc-800 rounded-full" />
          </div>
          {/* Check-in card */}
          <div className="h-14 bg-zinc-900 rounded-xl border border-zinc-800" />
          {/* Battery */}
          <div className="h-24 bg-zinc-900 rounded-2xl border border-zinc-800" />
          {/* Macro row */}
          <div className="flex items-center gap-4 px-1">
            <div className="h-10 w-14 bg-zinc-900 rounded-xl" />
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="h-14 bg-zinc-900 rounded-xl" />
              <div className="h-14 bg-zinc-900 rounded-xl" />
              <div className="h-14 bg-zinc-900 rounded-xl" />
            </div>
          </div>
          {/* Session hero */}
          <div className="h-44 bg-zinc-900 rounded-2xl border border-zinc-800" />
          {/* Meals label + cards */}
          <div className="space-y-2">
            <div className="h-2.5 w-10 bg-zinc-800 rounded-full" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-zinc-900 rounded-xl border border-zinc-800" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav active="today" />
    </>
  );
}
