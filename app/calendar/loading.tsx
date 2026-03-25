import BottomNav from "@/components/BottomNav";

export default function CalendarLoading() {
  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6 animate-pulse">
          {/* Week strip */}
          <div className="flex gap-1 mb-4">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-1 h-14 bg-zinc-900 rounded-xl border border-zinc-800" />
            ))}
          </div>
          {/* Day header */}
          <div className="h-5 w-32 bg-zinc-800 rounded-full mb-4" />
          {/* Event cards */}
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 bg-zinc-900 rounded-2xl border border-zinc-800" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav active="calendar" />
    </>
  );
}
