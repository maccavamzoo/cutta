// Single source of truth for "is this plan stale?".
// Pure: no DB, no side effects, no AI. Both /plan and /dashboard call this
// server-side so the two views can never disagree.

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  userProfiles,
  userActivityTypes,
  weeklyStrategies,
  calendarEvents,
} from "@/lib/db/schema";

export interface StalenessInputs {
  planGeneratedAt: Date | null;
  planHasOnBike:   boolean;
  lastDataChange:  Date | null;
  currentIsTraining: boolean;
}

export function isPlanStale(inputs: StalenessInputs): boolean {
  if (inputs.planGeneratedAt === null) return false;

  const timeStale = inputs.lastDataChange !== null
    && inputs.planGeneratedAt < inputs.lastDataChange;

  // Deleting a training event nulls fuellingPlans.calendarEventId via FK cascade
  // without bumping any updatedAt we'd read, so a once-training plan keeps
  // looking fresh. planHasOnBike is a reliable marker that the plan was built
  // for training; compare against today's current set of events.
  const shapeStale = inputs.planHasOnBike !== inputs.currentIsTraining;

  return timeStale || shapeStale;
}

// MAX(updated_at) across every table that can invalidate a fuelling plan:
// profile, activity types, weekly strategy, and ALL calendar events for the
// user (no date range — a future-day event edit still makes today's plan
// stale, and the two routes disagree if their windows differ).
export async function getLastDataChange(clerkUserId: string): Promise<Date | null> {
  const [profileRow, activityRow, strategyRow, eventRow] = await Promise.all([
    db
      .select({ maxUpdated: sql<Date | null>`MAX(${userProfiles.updatedAt})` })
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId)),
    db
      .select({ maxUpdated: sql<Date | null>`MAX(${userActivityTypes.updatedAt})` })
      .from(userActivityTypes)
      .where(eq(userActivityTypes.clerkUserId, clerkUserId)),
    db
      .select({ maxUpdated: sql<Date | null>`MAX(${weeklyStrategies.updatedAt})` })
      .from(weeklyStrategies)
      .where(eq(weeklyStrategies.clerkUserId, clerkUserId)),
    db
      .select({ maxUpdated: sql<Date | null>`MAX(${calendarEvents.updatedAt})` })
      .from(calendarEvents)
      .where(eq(calendarEvents.clerkUserId, clerkUserId)),
  ]);

  const candidates: Date[] = [
    profileRow[0]?.maxUpdated,
    activityRow[0]?.maxUpdated,
    strategyRow[0]?.maxUpdated,
    eventRow[0]?.maxUpdated,
  ]
    .map((v) => (v instanceof Date ? v : v != null ? new Date(v as string) : null))
    .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}
