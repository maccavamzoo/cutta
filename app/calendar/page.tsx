import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles, protocols } from "@/lib/db/schema";
import CalendarView from "./CalendarView";
import BottomNav from "@/components/BottomNav";
import type { ActivityTypeOption } from "@/app/plan/AddEventSheet";
import type { UnitSystem } from "@/lib/units";

function isNewFormatProtocol(content: unknown): boolean {
  if (typeof content !== "object" || content === null) return false;
  const restDay = (content as Record<string, Record<string, unknown>>).rest_day;
  return typeof restDay?.calorie_offset === "number";
}

export default async function CalendarPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profileRows, protocolRows] = await Promise.all([
    db
      .select({ timezone: userProfiles.timezone, unitSystem: userProfiles.unitSystem })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, userId))
      .limit(1),

    db
      .select({ content: protocols.content })
      .from(protocols)
      .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
      .limit(1),
  ]);

  const profileRow  = profileRows[0] ?? null;
  const protocolRow = protocolRows[0] ?? null;
  const timezone    = profileRow?.timezone ?? "Europe/London";
  const unitSystem  = (profileRow?.unitSystem ?? "metric") as UnitSystem;

  const activityTypes: ActivityTypeOption[] = (() => {
    if (!protocolRow || !isNewFormatProtocol(protocolRow.content)) return [];
    const content = protocolRow.content as Record<string, unknown>;
    if (!Array.isArray(content.activity_types)) return [];
    return (content.activity_types as Array<Record<string, unknown>>)
      .filter((at) => typeof at.name === "string")
      .map((at) => ({
        name:                     at.name as string,
        description:              (at.description as string) ?? "",
        default_duration_minutes: (at.default_duration_minutes as number) ?? 60,
      }));
  })();

  const monthStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone })
    .format(new Date())
    .slice(0, 7);

  return (
    <>
      <main className="min-h-[calc(100dvh-52px)] bg-black pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4">
          <CalendarView
            initialMonth={monthStr}
            timezone={timezone}
            unitSystem={unitSystem}
            activityTypes={activityTypes}
          />
        </div>
      </main>
      <BottomNav active="plan" />
    </>
  );
}
