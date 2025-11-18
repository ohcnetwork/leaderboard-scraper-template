import { addActivities, addContributors } from "@/lib/db";
import { Activity, ActivityDefinition } from "@/types/db";
import { subDays } from "date-fns";

/**
 * Get activities from the source
 * @param since - The date to get activities since
 * @returns The activities
 */
export async function getActivities(since?: string): Promise<Activity[]> {
  return [
    {
      slug: `example-activity-1-${new Date().toISOString()}`,
      contributor: "example-contributor-1",
      activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
      title: "Example Activity",
      occured_at: new Date(),
      link: "https://example.com",
      text: "Example Activity",
      points: 0,
      meta: { example: "example" },
    },
  ];
}

export async function main() {
  // Extract the number of days to scrape from the environment variable
  const days = process.env.SCRAPE_DAYS && parseInt(process.env.SCRAPE_DAYS);
  const since = days ? subDays(new Date(), days).toISOString() : undefined;

  // Get the activities
  console.log(`Getting activities since ${since}...`);
  const activities = await getActivities(since);
  console.log(`Found ${activities.length} activities`);

  // Add the contributors
  console.log(`Adding ${activities.length} contributors to database...`);
  await addContributors(activities.map((a) => a.contributor));
  console.log("✓ Successfully added contributors");

  // Add the activities
  console.log(`Adding ${activities.length} activities to database...`);
  await addActivities(activities);
  console.log("✓ Successfully added activities");
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
