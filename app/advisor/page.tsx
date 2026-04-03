import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdvisorView from "./AdvisorView";

export default async function AdvisorPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <AdvisorView />;
}
