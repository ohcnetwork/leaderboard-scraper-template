import {
  upsertActivityDefinitions,
  upsertGlobalAggregateDefinitions,
  upsertContributorAggregateDefinitions,
  upsertBadgeDefinition,
} from "@/lib/db";

export async function main() {
  await upsertActivityDefinitions();
  await upsertGlobalAggregateDefinitions();
  await upsertContributorAggregateDefinitions();

  // Upsert badge definitions
  // Example: Engagement Champion badge based on activity count
  await upsertBadgeDefinition({
    slug: "engagement_champion",
    name: "Engagement Champion",
    description:
      "Awarded for active participation and consistent engagement in the community",
    variants: {
      bronze: {
        description: "Bronze - 10 activities",
        svg_url: "/badges/engagement-bronze.svg",
        requirement: "Complete 10 activities",
      },
      silver: {
        description: "Silver - 50 activities",
        svg_url: "/badges/engagement-silver.svg",
        requirement: "Complete 50 activities",
      },
      gold: {
        description: "Gold - 100 activities",
        svg_url: "/badges/engagement-gold.svg",
        requirement: "Complete 100 activities",
      },
      platinum: {
        description: "Platinum - 500 activities",
        svg_url: "/badges/engagement-platinum.svg",
        requirement: "Complete 500 activities",
      },
      diamond: {
        description: "Diamond - 1000 activities",
        svg_url: "/badges/engagement-diamond.svg",
        requirement: "Complete 1000 activities",
      },
    },
  });

  console.log("✓ Badge definitions upserted");
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
