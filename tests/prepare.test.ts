import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, setupTestEnv } from "./utils/test-helpers";
import { getDb, resetDbInstance, upsertActivityDefinitions } from "@/lib/db";
import { ActivityDefinition } from "@/types/db";

describe("prepare.ts", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    setupTestEnv();

    // Create schema in the test database
    const db = getDb();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS activity_definition (
          slug                    VARCHAR PRIMARY KEY,
          name                    VARCHAR NOT NULL,
          description             TEXT NOT NULL,
          points                  SMALLINT,
          icon                    VARCHAR
      );
    `);
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDbInstance();
  });

  describe("Unit Tests", () => {
    it("should insert activity definitions correctly", async () => {
      await upsertActivityDefinitions();

      const db = getDb();
      const result = await db.query(
        "SELECT * FROM activity_definition WHERE slug = $1",
        [ActivityDefinition.EXAMPLE_ACTIVITY]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        slug: ActivityDefinition.EXAMPLE_ACTIVITY,
        name: "Example Activity",
        description: "Example Activity",
        points: 0,
        icon: "message-circle",
      });
    });

    it("should be idempotent (running twice doesn't duplicate)", async () => {
      // Run twice
      await upsertActivityDefinitions();
      await upsertActivityDefinitions();

      const db = getDb();
      const result = await db.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM activity_definition"
      );

      expect(result.rows[0]?.count).toBe(1);
    });

    it("should update existing activity definitions", async () => {
      const db = getDb();

      // Insert initial definition
      await upsertActivityDefinitions();

      // Manually update the definition
      await db.query(
        `UPDATE activity_definition SET name = 'Updated Name' WHERE slug = $1`,
        [ActivityDefinition.EXAMPLE_ACTIVITY]
      );

      // Run upsert again
      await upsertActivityDefinitions();

      // Should revert to original name
      const result = await db.query<{ name: string }>(
        "SELECT name FROM activity_definition WHERE slug = $1",
        [ActivityDefinition.EXAMPLE_ACTIVITY]
      );

      expect(result.rows[0]?.name).toBe("Example Activity");
    });

    it("should throw error when PGLITE_DB_PATH is not set", () => {
      delete process.env.PGLITE_DB_PATH;
      resetDbInstance();

      expect(() => getDb()).toThrow(
        "'PGLITE_DB_PATH' environment needs to be set"
      );
    });
  });

  describe("Integration Tests", () => {
    it("should successfully execute the full prepare workflow", async () => {
      // This simulates running the prepare.ts script
      await upsertActivityDefinitions();

      const db = getDb();
      // Verify activity definitions exist
      const result = await db.query("SELECT * FROM activity_definition");

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0]).toHaveProperty("slug");
      expect(result.rows[0]).toHaveProperty("name");
      expect(result.rows[0]).toHaveProperty("description");
    });

    it("should work with a fresh database", async () => {
      // Reset and create a completely new database
      resetDbInstance();
      const db = getDb();

      await db.exec(`
        CREATE TABLE IF NOT EXISTS activity_definition (
            slug                    VARCHAR PRIMARY KEY,
            name                    VARCHAR NOT NULL,
            description             TEXT NOT NULL,
            points                  SMALLINT,
            icon                    VARCHAR
        );
      `);

      await upsertActivityDefinitions();

      const result = await db.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM activity_definition"
      );

      expect(result.rows[0]?.count).toBeGreaterThan(0);
    });

    it("should run the actual prepare.ts script", async () => {
      // Import and run the actual script's main function
      const { main } = await import("@/scripts/prepare");
      await main();

      // Verify the result
      const db = getDb();
      const result = await db.query("SELECT * FROM activity_definition");

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0]).toHaveProperty(
        "slug",
        ActivityDefinition.EXAMPLE_ACTIVITY
      );
    });
  });
});
