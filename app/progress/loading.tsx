import BottomNav from "@/components/BottomNav";

export default function ProgressLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6 space-y-8">
          <div className="space-y-1">
            <div className="h-8 w-28 bg-zinc-900 rounded-lg animate-pulse" />
            <div className="h-4 w-40 bg-zinc-900 rounded animate-pulse" />
          </div>

          {/* Weight section */}
          <div className="space-y-3">
            <div className="h-3 w-20 bg-zinc-900 rounded animate-pulse" />
            <div className="h-14 bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="h-[210px] bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />
              <div className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />
            </div>
          </div>

          {/* Compliance section */}
          <div className="space-y-3">
            <div className="h-3 w-28 bg-zinc-900 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>

          {/* Energy section */}
          <div className="space-y-3">
            <div className="h-3 w-24 bg-zinc-900 rounded animate-pulse" />
            <div className="h-[160px] bg-zinc-900 rounded-2xl animate-pulse" />
          </div>
        </div>
      </main>
      <BottomNav active="progress" />
    </>
  );
}
