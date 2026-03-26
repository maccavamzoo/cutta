import BottomNav from "@/components/BottomNav";

export default function ProgressLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
          <div className="mb-6 space-y-2">
            <div className="h-8 w-32 bg-zinc-900 rounded-lg animate-pulse" />
            <div className="h-4 w-56 bg-zinc-900 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-32 bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="h-32 bg-zinc-900 rounded-2xl animate-pulse" />
          </div>
        </div>
      </main>
      <BottomNav active="progress" />
    </>
  );
}
