export default function PlanLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6">
          <div className="space-y-3">
            <div className="mb-5">
              <div className="h-7 w-16 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse mt-2" />
            </div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 h-[88px] animate-pulse" />
            ))}
          </div>
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur border-t border-zinc-800 z-40">
        <div className="flex max-w-lg mx-auto">
          {["Today", "Plan", "Progress", "Settings", "More"].map((label) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1 py-3">
              <div className="w-4 h-4 bg-zinc-800 rounded-full" />
              <span className={`text-xs font-medium ${label === "Plan" ? "text-lime-400" : "text-zinc-600"}`}>{label}</span>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
