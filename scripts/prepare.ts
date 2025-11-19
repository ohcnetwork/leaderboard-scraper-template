import {
  upsertActivityDefinitions,
  upsertGlobalAggregateDefinitions,
  upsertContributorAggregateDefinitions,
} from "@/lib/db";

export async function main() {
  await upsertActivityDefinitions();
  await upsertGlobalAggregateDefinitions();
  await upsertContributorAggregateDefinitions();
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
