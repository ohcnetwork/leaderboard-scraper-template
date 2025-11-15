import { upsertActivityDefinitions } from "@/lib/db";

export async function main() {
  await upsertActivityDefinitions();
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
