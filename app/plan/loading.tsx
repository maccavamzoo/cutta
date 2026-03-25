import BottomNav from "@/components/BottomNav";

export default function PlanLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-4 animate-pulse">
          {/* Generate button */}
          <div className="h-12 bg-zinc-900 rounded-xl border border-zinc-800" />
          {/* Day cards */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-zinc-800 rounded-full" />
                <div className="h-5 w-16 bg-zinc-800 rounded-full" />
              </div>
              <div className="h-3 w-40 bg-zinc-800 rounded-full" />
              <div className="h-2 w-full bg-zinc-800 rounded-full mt-1" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav active="plan" />
    </>
  );
}
