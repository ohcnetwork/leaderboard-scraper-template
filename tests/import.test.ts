import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestEnv, createTempDir, cleanupTempDir } from "./utils/test-helpers";
import { getDb, resetDbInstance } from "@/lib/db";
import { main } from "@/scripts/import";
import { ActivityDefinition, Activity } from "@/types/db";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

describe("import.ts", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    setupTestEnv();
    tempDir = await createTempDir();
    process.env.LEADERBOARD_DATA_PATH = tempDir;

    // Create schema
    const db = getDb();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS contributor (
          username                VARCHAR PRIMARY KEY,
          avatar_url              VARCHAR,
          profile_url             VARCHAR
      );

      CREATE TABLE IF NOT EXISTS activity_definition (
          slug                    VARCHAR PRIMARY KEY,
          name                    VARCHAR NOT NULL,
          description             TEXT NOT NULL,
          points                  SMALLINT,
          icon                    VARCHAR
      );

      CREATE TABLE IF NOT EXISTS activity (
          slug                    VARCHAR PRIMARY KEY,
          contributor             VARCHAR REFERENCES contributor(username) NOT NULL,
          activity_definition     VARCHAR REFERENCES activity_definition(slug) NOT NULL,
          title                   VARCHAR,
          occured_at              TIMESTAMP NOT NULL,
          link                    VARCHAR,
          text                    TEXT,
          points                  SMALLINT,
          meta                    JSON
      );
    `);

    // Insert activity definition
    await db.query(`
      INSERT INTO activity_definition (slug, name, description, points, icon)
      VALUES 
        ('${ActivityDefinition.EXAMPLE_ACTIVITY}', 'Example Activity', 'Example Activity', 0, 'message-circle')
      ON CONFLICT (slug) DO NOTHING;
    `);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    process.env = originalEnv;
    resetDbInstance();
  });

  describe("Integration Tests", () => {
    it("should run the actual import.ts script", async () => {
      // Create test data files
      const inputDir = join(tempDir, "data", "<scraper-name>", "activities");
      await mkdir(inputDir, { recursive: true });

      const activities: Activity[] = [
        {
          slug: "test-1",
          contributor: "user1",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test 1",
          occured_at: new Date(),
          link: "https://example.com",
          text: "Test",
          points: 0,
          meta: null,
        },
      ];

      await writeFile(
        join(inputDir, "user1.json"),
        JSON.stringify(activities, null, 2),
        "utf-8"
      );

      // Run the import script
      await main();

      // Verify data was imported
      const db = getDb();
      const result = await db.query("SELECT * FROM activity");
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty("slug", "test-1");

      const contributorResult = await db.query("SELECT * FROM contributor");
      expect(contributorResult.rows).toHaveLength(1);
      expect(contributorResult.rows[0]).toHaveProperty("username", "user1");
    });

    it("should throw error when LEADERBOARD_DATA_PATH is not set", async () => {
      delete process.env.LEADERBOARD_DATA_PATH;

      await expect(main()).rejects.toThrow(
        "LEADERBOARD_DATA_PATH environment variable is not set"
      );
    });

    it("should handle non-existent directory gracefully", async () => {
      // Directory doesn't exist, should not throw
      await expect(main()).resolves.not.toThrow();
    });

    it("should handle empty directory (no JSON files)", async () => {
      const inputDir = join(tempDir, "data", "<scraper-name>", "activities");
      await mkdir(inputDir, { recursive: true });

      // Should not throw
      await expect(main()).resolves.not.toThrow();

      // No data should be imported
      const db = getDb();
      const result = await db.query("SELECT * FROM activity");
      expect(result.rows).toHaveLength(0);
    });

    it("should import multiple contributor files", async () => {
      const inputDir = join(tempDir, "data", "<scraper-name>", "activities");
      await mkdir(inputDir, { recursive: true });

      const user1Activities: Activity[] = [
        {
          slug: "test-1",
          contributor: "user1",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test 1",
          occured_at: new Date(),
          link: null,
          text: null,
          points: 0,
          meta: null,
        },
      ];

      const user2Activities: Activity[] = [
        {
          slug: "test-2",
          contributor: "user2",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test 2",
          occured_at: new Date(),
          link: null,
          text: null,
          points: 0,
          meta: null,
        },
      ];

      await writeFile(
        join(inputDir, "user1.json"),
        JSON.stringify(user1Activities, null, 2),
        "utf-8"
      );
      await writeFile(
        join(inputDir, "user2.json"),
        JSON.stringify(user2Activities, null, 2),
        "utf-8"
      );

      await main();

      const db = getDb();
      const result = await db.query("SELECT * FROM activity");
      expect(result.rows).toHaveLength(2);

      const contributorResult = await db.query("SELECT * FROM contributor");
      expect(contributorResult.rows).toHaveLength(2);
    });

    it("should convert date strings to Date objects during import", async () => {
      const inputDir = join(tempDir, "data", "<scraper-name>", "activities");
      await mkdir(inputDir, { recursive: true });

      const dateString = "2024-01-15T10:30:00.000Z";
      const activities = [
        {
          slug: "test-1",
          contributor: "user1",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test",
          occured_at: dateString, // String in JSON
          link: null,
          text: null,
          points: 0,
          meta: null,
        },
      ];

      await writeFile(
        join(inputDir, "user1.json"),
        JSON.stringify(activities, null, 2),
        "utf-8"
      );

      await main();

      const db = getDb();
      const result = await db.query<{ occured_at: string }>(
        "SELECT occured_at FROM activity"
      );
      
      // Verify it was stored as a timestamp
      expect(result.rows[0]?.occured_at).toBeDefined();
    });

    it("should preserve metadata during import", async () => {
      const inputDir = join(tempDir, "data", "<scraper-name>", "activities");
      await mkdir(inputDir, { recursive: true });

      const activities: Activity[] = [
        {
          slug: "test-1",
          contributor: "user1",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test",
          occured_at: new Date(),
          link: null,
          text: null,
          points: 0,
          meta: { key: "value", nested: "data" },
        },
      ];

      await writeFile(
        join(inputDir, "user1.json"),
        JSON.stringify(activities, null, 2),
        "utf-8"
      );

      await main();

      const db = getDb();
      const result = await db.query<{ meta: Record<string, string> }>(
        "SELECT meta FROM activity"
      );

      expect(result.rows[0]?.meta).toEqual({ key: "value", nested: "data" });
    });
  });
});
