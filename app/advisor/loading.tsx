import BottomNav from "@/components/BottomNav";

export default function AdvisorLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
          <div className="h-8 w-32 bg-zinc-900 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-zinc-900 rounded animate-pulse" />
          <div className="flex-1 space-y-3 pt-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav active="ai" />
    </>
  );
}
