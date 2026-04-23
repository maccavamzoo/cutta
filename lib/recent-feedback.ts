// Shared 7-day feedback aggregation.
// Used by the fuelling-plan API routes and by the Plan page to assemble
// PlanEngineInput["recentFeedback"] from raw compliance + feedback rows.

import type { PlanEngineInput } from "@/lib/plan-engine";

export interface FeedbackRow {
  feedbackType: string;
  rating: number;
}

export interface ComplianceRow {
  compliance: string;
}

export function aggregateRecentFeedback(
  feedbackRows: FeedbackRow[],
  complianceRows: ComplianceRow[],
): PlanEngineInput["recentFeedback"] {
  const hungerEntries = feedbackRows.filter((f) => f.feedbackType === "hunger");
  const energyEntries = feedbackRows.filter((f) => f.feedbackType === "ride_energy");
  const stoolEntries  = feedbackRows.filter((f) => f.feedbackType === "stool_health");

  return {
    highHungerDays:    hungerEntries.filter((f) => f.rating >= 4).length,
    lowEnergyDays:     energyEntries.filter((f) => f.rating <= 2).length,
    looseStoolDays:    stoolEntries.filter((f)  => f.rating <= 2).length,
    constipatedDays:   stoolEntries.filter((f)  => f.rating >= 4).length,
    lowComplianceDays: complianceRows.filter((c) => c.compliance === "no").length,
  };
}
