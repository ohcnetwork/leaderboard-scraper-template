import {
  getDb,
  upsertContributorAggregates,
  upsertGlobalAggregates,
  getActivityCounts,
  upsertContributorBadges,
} from "@/lib/db";
import { ContributorBadge } from "@/types/db";

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

/**
 * Example function to award badges based on activity count
 * This demonstrates how to:
 * 1. Query activity counts efficiently with a single GROUP BY query
 * 2. Check which badge variants contributors qualify for
 * 3. Award all qualifying badges at once
 * 4. Use ON CONFLICT DO NOTHING to avoid overwriting existing badges
 */
async function awardEngagementChampionBadges() {
  console.log("Awarding Engagement Champion badges...");

  // Get activity counts for all contributors (single efficient query)
  const activityCounts = await getActivityCounts();
  console.log(`Found ${activityCounts.size} contributors with activities`);

  // Define badge thresholds
  const thresholds = [
    { variant: "bronze", required: 10 },
    { variant: "silver", required: 50 },
    { variant: "gold", required: 100 },
    { variant: "platinum", required: 500 },
    { variant: "diamond", required: 1000 },
  ];

  const badgesToAward: ContributorBadge[] = [];

  // For each contributor, check which badge variants they qualify for
  for (const [
    contributor,
    { count, first_activity_at },
  ] of activityCounts.entries()) {
    for (const threshold of thresholds) {
      if (count >= threshold.required) {
        badgesToAward.push({
          slug: `engagement_champion__${contributor}__${threshold.variant}`,
          badge: "engagement_champion",
          contributor,
          variant: threshold.variant,
          achieved_on: first_activity_at, // Use first activity date as achievement date
          meta: {
            activity_count: count,
            threshold: threshold.required,
            awarded_by: "automated",
          },
        });
      }
    }
  }

  console.log(`Awarding ${badgesToAward.length} badge variants...`);

  if (badgesToAward.length > 0) {
    await upsertContributorBadges(badgesToAward);
  }

  console.log("✓ Engagement Champion badges awarded");
}

async function main() {
  // Calculate and store example aggregates
  await calculateAndUpsertExampleMetric();

  // Award Engagement Champion badges
  await awardEngagementChampionBadges();
}

main();
