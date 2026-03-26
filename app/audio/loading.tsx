import BottomNav from "@/components/BottomNav";

export default function AudioLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6 animate-pulse">
          {/* Page header */}
          <div className="mb-6 space-y-2">
            <div className="h-7 w-36 bg-zinc-800 rounded-full" />
            <div className="h-3 w-64 bg-zinc-800 rounded-full" />
          </div>
          {/* Record card */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-5 py-6">
            <div className="flex flex-col items-center gap-6">
              <div className="h-3 w-36 bg-zinc-800 rounded-full" />
              <div className="w-24 h-24 rounded-full bg-zinc-800" />
            </div>
          </div>
        </div>
      </main>
      <BottomNav active="more" />
    </>
  );
}
