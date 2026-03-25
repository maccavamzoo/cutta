export default function RootLoading() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-3">
      <p className="text-white text-3xl font-bold tracking-tight">Cutta</p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
