import {
  getDb,
  upsertContributorAggregates,
  upsertGlobalAggregates,
} from "@/lib/db";

/**
 * Example function to calculate and upsert aggregates
 * This demonstrates how to:
 * 1. Query activities with aggregate data in meta
 * 2. Calculate per-contributor and global averages
 * 3. Store the results in aggregate tables
 */
async function calculateAndUpsertExampleMetric() {
  const db = getDb();

  // Query all activities with example_metric in meta
  const result = await db.query<{
    contributor: string;
    example_metric: string;
  }>(
    `SELECT contributor, (meta->>'example_metric')::numeric as example_metric
     FROM activity 
     WHERE activity_definition = 'example_activity' 
       AND meta->>'example_metric' IS NOT NULL`
  );

  // Calculate per-contributor averages
  const contributorMetrics = new Map<string, number[]>();
  const allMetrics: number[] = [];

  for (const row of result.rows) {
    const metric = Number(row.example_metric);
    if (!isNaN(metric)) {
      if (!contributorMetrics.has(row.contributor)) {
        contributorMetrics.set(row.contributor, []);
      }
      contributorMetrics.get(row.contributor)!.push(metric);
      allMetrics.push(metric);
    }
  }

  // Prepare contributor aggregates
  const contributorAggregates = Array.from(contributorMetrics.entries()).map(
    ([contributor, metrics]) => ({
      aggregate: "example_avg_metric",
      contributor,
      value: {
        type: "number" as const,
        value: Math.round(
          metrics.reduce((sum, m) => sum + m, 0) / metrics.length
        ),
      },
    })
  );

  // Calculate global average
  const globalAvg =
    allMetrics.length > 0
      ? Math.round(
          allMetrics.reduce((sum, m) => sum + m, 0) / allMetrics.length
        )
      : null;

  // Upsert aggregates
  if (contributorAggregates.length > 0) {
    await upsertContributorAggregates(contributorAggregates);
    console.log(
      `Updated example metric for ${contributorAggregates.length} contributors`
    );
  }

  if (globalAvg !== null) {
    await upsertGlobalAggregates([
      {
        slug: "example_avg_metric",
        name: "Example Avg. Metric",
        description: "Average of an example metric",
        value: {
          type: "number",
          value: globalAvg,
        },
      },
    ]);
    console.log(`Updated global example metric: ${globalAvg}`);
  }
}

async function main() {
  // Calculate and store example aggregates
  await calculateAndUpsertExampleMetric();
}

main();
