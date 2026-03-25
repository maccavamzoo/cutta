import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { protocols } from "@/lib/db/schema";
import { ProtocolFile } from "@/lib/protocol";
import ProtocolUpload from "./ProtocolUpload";

export default async function ProtocolSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [active] = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.clerkUserId, userId), eq(protocols.isActive, true)))
    .limit(1);

  const content = active?.content as ProtocolFile | undefined;

  return (
    <main className="min-h-[calc(100dvh-52px)] bg-black px-4 py-6 max-w-lg mx-auto space-y-8">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
      >
        ← Back
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">Protocol</h1>
        <p className="text-zinc-500 text-sm">
          Your fuelling rulebook. The AI follows this when building your plan.
        </p>
      </div>

      {/* Active protocol card */}
      {active && content ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-lime-400 shrink-0" />
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Active protocol
            </h2>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Name</p>
              <p className="text-white font-semibold text-lg leading-tight">
                {content.protocol_name}
              </p>
            </div>

            {(content.target_weight_kg !== undefined ||
              content.max_weekly_loss_kg !== undefined) && (
              <div className="grid grid-cols-2 gap-4">
                {content.target_weight_kg !== undefined && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                      Target weight
                    </p>
                    <p className="text-white font-medium">
                      {content.target_weight_kg} kg
                    </p>
                  </div>
                )}
                {content.max_weekly_loss_kg !== undefined && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                      Max loss / week
                    </p>
                    <p className="text-white font-medium">
                      {content.max_weekly_loss_kg} kg
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Day-type summaries */}
            {(content.rest_day || content.training_day || content.on_bike) && (
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                {content.rest_day && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                      Rest day
                    </p>
                    <p className="text-zinc-300 text-sm">
                      {[
                        content.rest_day.calories,
                        content.rest_day.carbs && `carbs ${content.rest_day.carbs}`,
                        content.rest_day.protein &&
                          `protein ${content.rest_day.protein}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                )}
                {content.training_day && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                      Training day
                    </p>
                    <p className="text-zinc-300 text-sm">
                      {[
                        content.training_day.calories,
                        content.training_day.carbs &&
                          `carbs ${content.training_day.carbs}`,
                        content.training_day.protein &&
                          `protein ${content.training_day.protein}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                )}
                {content.on_bike && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                      On-bike fuelling
                    </p>
                    <p className="text-zinc-300 text-sm">
                      {String(
                        content.on_bike.over_90min ??
                          content.on_bike.under_90min ??
                          ""
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-600">
                Uploaded{" "}
                {new Date(active.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center space-y-1">
          <p className="text-zinc-500 text-sm">No protocol uploaded yet.</p>
          <p className="text-zinc-600 text-xs">
            Upload one below — the AI needs it to generate your fuelling plan.
          </p>
        </div>
      )}

      {/* Upload section */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {active ? "Replace protocol" : "Upload protocol"}
          </h2>
          {active && (
            <p className="text-zinc-600 text-xs mt-1">
              Uploading a new protocol will deactivate the current one.
            </p>
          )}
        </div>
        <p className="text-zinc-600 text-xs">
          Must be a <code className="text-zinc-400">.json</code> file with at
          least a <code className="text-zinc-400">protocol_name</code> field.
        </p>
        <ProtocolUpload hasActiveProtocol={!!active} />
      </section>
    </main>
  );
}
