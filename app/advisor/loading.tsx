import BottomNav from "@/components/BottomNav";

export default function AdvisorLoading() {
  return (
    <>
      {/* Header skeleton — matches AdvisorView sticky header */}
      <div className="sticky top-0 z-30 bg-black px-4 pt-5 pb-3 border-b border-zinc-800">
        <div className="max-w-lg mx-auto">
          <div className="h-7 w-28 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-4 w-44 bg-zinc-800/50 rounded animate-pulse mt-2" />
        </div>
      </div>

      {/* Messages skeleton */}
      <div className="px-4 py-4 pb-[140px]">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="py-12 text-center">
            <div className="h-4 w-32 bg-zinc-800/50 rounded animate-pulse mx-auto" />
          </div>
        </div>
      </div>

      <BottomNav active="ai" />
    </>
  );
}
