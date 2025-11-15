import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestEnv, createTempDir, cleanupTempDir } from "./utils/test-helpers";
import { getDb, resetDbInstance, addContributors, addActivities } from "@/lib/db";
import { main } from "@/scripts/export";
import { ActivityDefinition, Activity } from "@/types/db";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

describe("export.ts", () => {
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
          avatar_url              VARCHAR
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
    it("should run the actual export.ts script", async () => {
      // Add some test data
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
        {
          slug: "test-2",
          contributor: "user2",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test 2",
          occured_at: new Date(),
          link: "https://example.com",
          text: "Test",
          points: 0,
          meta: null,
        },
      ];

      await addContributors(["user1", "user2"]);
      await addActivities(activities);

      // Run the export script
      await main();

      // Verify files were created
      const outputDir = join(tempDir, "data", "<scraper-name>", "activities");
      expect(existsSync(outputDir)).toBe(true);

      const files = await readdir(outputDir);
      expect(files).toHaveLength(2);
      expect(files).toContain("user1.json");
      expect(files).toContain("user2.json");

      // Verify file contents
      const user1Content = await readFile(join(outputDir, "user1.json"), "utf-8");
      const user1Data = JSON.parse(user1Content);
      expect(user1Data).toHaveLength(1);
      expect(user1Data[0].slug).toBe("test-1");
    });

    it("should throw error when LEADERBOARD_DATA_PATH is not set", async () => {
      delete process.env.LEADERBOARD_DATA_PATH;

      await expect(main()).rejects.toThrow(
        "LEADERBOARD_DATA_PATH environment variable is not set"
      );
    });

    it("should handle empty database", async () => {
      // Run export with no data
      await main();

      const outputDir = join(tempDir, "data", "<scraper-name>", "activities");
      expect(existsSync(outputDir)).toBe(true);

      const files = await readdir(outputDir);
      expect(files).toHaveLength(0);
    });

    it("should group activities by contributor", async () => {
      const activities: Activity[] = [
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
        {
          slug: "test-2",
          contributor: "user1",
          activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
          title: "Test 2",
          occured_at: new Date(),
          link: null,
          text: null,
          points: 0,
          meta: null,
        },
      ];

      await addContributors(["user1"]);
      await addActivities(activities);
      await main();

      const outputDir = join(tempDir, "data", "<scraper-name>", "activities");
      const user1Content = await readFile(join(outputDir, "user1.json"), "utf-8");
      const user1Data = JSON.parse(user1Content);
      
      expect(user1Data).toHaveLength(2);
    });
  });
});
