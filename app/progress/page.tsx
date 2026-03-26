import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">Progress</h1>
            <p className="text-zinc-500 text-sm mt-1">
              Track your training and nutrition trends.
            </p>
          </div>

          <div className="py-16 text-center space-y-2">
            <p className="text-zinc-400 font-medium">Coming soon</p>
            <p className="text-zinc-600 text-sm max-w-xs mx-auto leading-relaxed">
              Weekly trends, weight tracking, compliance history, and performance insights will appear here.
            </p>
          </div>
        </div>
      </main>

      <BottomNav active="progress" />
    </>
  );
}
