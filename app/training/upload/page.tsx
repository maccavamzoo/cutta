import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import UploadFlow from "./UploadFlow";

export default async function TrainingUploadPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/calendar"
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          ← Calendar
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Log training
        </h1>
      </div>

      <p className="text-zinc-500 text-sm mb-6">
        Upload a screenshot from Strava or Rouvy. The AI will extract your
        training data — check the values and confirm.
      </p>

      <UploadFlow />
    </main>
  );
}
