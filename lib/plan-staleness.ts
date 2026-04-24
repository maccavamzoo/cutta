// Single source of truth for "is this plan stale?".
// Pure: no DB, no side effects, no AI. Both /plan and /dashboard call this
// server-side so the two views can never disagree.

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
