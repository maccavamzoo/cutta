import BottomNav from "@/components/BottomNav";

export default function ShoppingLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6 animate-pulse">
          {/* Page header */}
          <div className="mb-6 space-y-2">
            <div className="h-7 w-40 bg-zinc-800 rounded-full" />
            <div className="h-3 w-56 bg-zinc-800 rounded-full" />
          </div>
          {/* Generate button */}
          <div className="h-12 bg-zinc-900 rounded-xl border border-zinc-800 mb-5" />
          {/* Category sections */}
          {[8, 5, 6, 4].map((count, ci) => (
            <div key={ci} className="mb-3 rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-zinc-900">
                <div className="h-2.5 w-20 bg-zinc-800 rounded-full" />
              </div>
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-zinc-800/60">
                  <div className="w-5 h-5 rounded border border-zinc-700 shrink-0" />
                  <div className="flex-1 h-3 bg-zinc-800 rounded-full" />
                  <div className="h-3 w-8 bg-zinc-800 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav active="shop" />
    </>
  );
}
