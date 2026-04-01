import type { ProtocolFile } from "@/lib/protocol";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm shrink-0">{label}</span>
      <span className="text-zinc-200 text-sm text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 space-y-0">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function ProtocolReadable({
  protocol,
  activatedAt,
}: {
  protocol: ProtocolFile;
  activatedAt: Date;
}) {
  const { rest_day, training_day, pre_ride, on_bike, post_ride, race_week } = protocol;

  return (
    <div className="space-y-3">
      {/* Description + meta */}
      {(protocol.description || protocol.target_weight_kg !== undefined || protocol.max_weekly_loss_kg !== undefined) && (
        <Section title="Overview">
          {protocol.description && (
            <p className="text-zinc-300 text-sm pb-2">{protocol.description}</p>
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
      )}

      {/* Rest day */}
      {rest_day && (
        <Section title="Rest day">
          {rest_day.calories && <Row label="Calories" value={String(rest_day.calories)} />}
          {rest_day.carbs    && <Row label="Carbs"    value={String(rest_day.carbs)} />}
          {rest_day.protein  && <Row label="Protein"  value={String(rest_day.protein)} />}
          {rest_day.fat      && <Row label="Fat"      value={String(rest_day.fat)} />}
        </Section>
      )}

      {/* Training day */}
      {training_day && (
        <Section title="Training day">
          {training_day.calories && <Row label="Calories" value={String(training_day.calories)} />}
          {training_day.carbs    && <Row label="Carbs"    value={String(training_day.carbs)} />}
          {training_day.protein  && <Row label="Protein"  value={String(training_day.protein)} />}
          {training_day.fat      && <Row label="Fat"      value={String(training_day.fat)} />}
        </Section>
      )}

      {/* Pre-ride */}
      {pre_ride && (
        <Section title="Pre-ride">
          {pre_ride.timing_hours_before !== undefined && (
            <Row label="Timing" value={`${pre_ride.timing_hours_before} hrs before`} />
          )}
          {pre_ride.focus && <Row label="Focus" value={String(pre_ride.focus)} />}
        </Section>
      )}

      {/* On-bike */}
      {on_bike && (
        <Section title="On-bike fuelling">
          {on_bike.under_90min && <Row label="Under 90 min" value={String(on_bike.under_90min)} />}
          {on_bike.over_90min  && <Row label="Over 90 min"  value={String(on_bike.over_90min)} />}
          {on_bike.over_3hrs   && <Row label="Over 3 hrs"   value={String(on_bike.over_3hrs)} />}
        </Section>
      )}

      {/* Post-ride */}
      {post_ride && (
        <Section title="Post-ride">
          {post_ride.timing_minutes_after !== undefined && (
            <Row label="Timing" value={`within ${post_ride.timing_minutes_after} min`} />
          )}
          {post_ride.focus && <Row label="Focus" value={String(post_ride.focus)} />}
        </Section>
      )}

      {/* Race week */}
      {race_week && (
        <Section title="Race week">
          {race_week.strategy && <Row label="Strategy" value={String(race_week.strategy)} />}
        </Section>
      )}
    </div>
  );
}
