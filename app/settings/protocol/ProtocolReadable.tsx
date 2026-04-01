import type { ReactNode } from "react";
import type { ProtocolFile } from "@/lib/protocol";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.map(formatValue).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${formatValue(val)}`)
      .join("; ");
  }
  return String(v);
}

function labelFor(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extraEntries(
  obj: Record<string, unknown>,
  known: readonly string[]
): [string, unknown][] {
  const knownSet = new Set(known);
  return Object.entries(obj).filter(
    ([k, v]) => !knownSet.has(k) && v !== undefined && v !== null
  );
}

// ─── primitives ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm shrink-0">{label}</span>
      <span className="text-zinc-200 text-sm text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}

// ─── known field sets ────────────────────────────────────────────────────────

const KNOWN_TOP_LEVEL = [
  "protocol_name", "description", "target_weight_kg", "max_weekly_loss_kg",
  "rest_day", "training_day", "pre_ride", "on_bike", "post_ride", "race_week",
] as const;

const KNOWN_DAY_MACROS  = ["calories", "carbs", "protein", "fat"] as const;
const KNOWN_PRE_RIDE    = ["timing_hours_before", "focus"] as const;
const KNOWN_ON_BIKE     = ["under_90min", "over_90min", "over_3hrs"] as const;
const KNOWN_POST_RIDE   = ["timing_minutes_after", "focus"] as const;
const KNOWN_RACE_WEEK   = ["strategy"] as const;

// ─── component ──────────────────────────────────────────────────────────────

export default function ProtocolReadable({
  protocol,
  activatedAt,
}: {
  protocol: ProtocolFile;
  activatedAt: Date;
}) {
  const { rest_day, training_day, pre_ride, on_bike, post_ride, race_week } = protocol;

  const topLevelExtras = extraEntries(
    protocol as Record<string, unknown>,
    KNOWN_TOP_LEVEL
  );

  return (
    <div className="space-y-3">
      {/* Overview — always shown */}
      <Section title="Overview">
        {protocol.description && (
          <p className="text-zinc-300 text-sm pb-2 border-b border-zinc-800 mb-0">{protocol.description}</p>
        )}
        {protocol.target_weight_kg !== undefined && (
          <Row label="Target weight" value={`${protocol.target_weight_kg} kg`} />
        )}
        {protocol.max_weekly_loss_kg !== undefined && (
          <Row label="Max loss / week" value={`${protocol.max_weekly_loss_kg} kg`} />
        )}
        <Row
          label="Activated"
          value={activatedAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />
      </Section>

      {/* Rest day */}
      {rest_day && (
        <Section title="Rest day">
          {rest_day.calories && <Row label="Calories" value={String(rest_day.calories)} />}
          {rest_day.carbs    && <Row label="Carbs"    value={String(rest_day.carbs)} />}
          {rest_day.protein  && <Row label="Protein"  value={String(rest_day.protein)} />}
          {rest_day.fat      && <Row label="Fat"      value={String(rest_day.fat)} />}
          {extraEntries(rest_day as Record<string, unknown>, KNOWN_DAY_MACROS).map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}

      {/* Training day */}
      {training_day && (
        <Section title="Training day">
          {training_day.calories && <Row label="Calories" value={String(training_day.calories)} />}
          {training_day.carbs    && <Row label="Carbs"    value={String(training_day.carbs)} />}
          {training_day.protein  && <Row label="Protein"  value={String(training_day.protein)} />}
          {training_day.fat      && <Row label="Fat"      value={String(training_day.fat)} />}
          {extraEntries(training_day as Record<string, unknown>, KNOWN_DAY_MACROS).map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}

      {/* Pre-ride */}
      {pre_ride && (
        <Section title="Pre-ride">
          {pre_ride.timing_hours_before !== undefined && (
            <Row label="Timing" value={`${pre_ride.timing_hours_before} hrs before`} />
          )}
          {pre_ride.focus && <Row label="Focus" value={String(pre_ride.focus)} />}
          {extraEntries(pre_ride as Record<string, unknown>, KNOWN_PRE_RIDE).map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}

      {/* On-bike */}
      {on_bike && (
        <Section title="On-bike fuelling">
          {on_bike.under_90min && <Row label="Under 90 min" value={String(on_bike.under_90min)} />}
          {on_bike.over_90min  && <Row label="Over 90 min"  value={String(on_bike.over_90min)} />}
          {on_bike.over_3hrs   && <Row label="Over 3 hrs"   value={String(on_bike.over_3hrs)} />}
          {extraEntries(on_bike as Record<string, unknown>, KNOWN_ON_BIKE).map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}

      {/* Post-ride */}
      {post_ride && (
        <Section title="Post-ride">
          {post_ride.timing_minutes_after !== undefined && (
            <Row label="Timing" value={`within ${post_ride.timing_minutes_after} min`} />
          )}
          {post_ride.focus && <Row label="Focus" value={String(post_ride.focus)} />}
          {extraEntries(post_ride as Record<string, unknown>, KNOWN_POST_RIDE).map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}

      {/* Race week */}
      {race_week && (
        <Section title="Race week">
          {race_week.strategy && <Row label="Strategy" value={String(race_week.strategy)} />}
          {extraEntries(race_week as Record<string, unknown>, KNOWN_RACE_WEEK).map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}

      {/* Other rules — top-level extra keys */}
      {topLevelExtras.length > 0 && (
        <Section title="Other rules">
          {topLevelExtras.map(([k, v]) => (
            <Row key={k} label={labelFor(k)} value={formatValue(v)} />
          ))}
        </Section>
      )}
    </div>
  );
}
