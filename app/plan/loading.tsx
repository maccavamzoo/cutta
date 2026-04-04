import BottomNav from "@/components/BottomNav";

export default function PlanLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 animate-pulse">
          {/* Heading */}
          <div className="mb-5 space-y-2">
            <div className="h-7 w-16 bg-zinc-800 rounded-full" />
            <div className="h-4 w-48 bg-zinc-800 rounded-full" />
          </div>
          {/* Day cards */}
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-zinc-800 rounded-full" />
                  <div className="h-5 w-16 bg-zinc-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav active="plan" />
    </>
  );
}
