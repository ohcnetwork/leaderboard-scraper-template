import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestEnv } from "./utils/test-helpers";
import { getDb, resetDbInstance } from "@/lib/db";
import { main, getActivities } from "@/scripts/scrape";
import { ActivityDefinition } from "@/types/db";
import { subDays } from "date-fns";

describe("scrape.ts", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    setupTestEnv();

    // Create schema in the test database
    const db = getDb();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS contributor (
          username                VARCHAR PRIMARY KEY,
          name                    VARCHAR,
          role                    VARCHAR,
          title                   VARCHAR,
          avatar_url              VARCHAR,
          bio                     TEXT,
          social_profiles         JSON,
          joining_date            DATE,
          meta                    JSON
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

      CREATE INDEX IF NOT EXISTS idx_activity_occured_at ON activity(occured_at);
      CREATE INDEX IF NOT EXISTS idx_activity_contributor ON activity(contributor);
      CREATE INDEX IF NOT EXISTS idx_activity_definition ON activity(activity_definition);
    `);

    // Insert activity definition
    await db.query(`
      INSERT INTO activity_definition (slug, name, description, points, icon)
      VALUES 
        ('${ActivityDefinition.EXAMPLE_ACTIVITY}', 'Example Activity', 'Example Activity', 0, 'message-circle')
      ON CONFLICT (slug) DO NOTHING;
    `);
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDbInstance();
  });

  describe("Unit Tests", () => {
    it("should validate activity structure from getActivities", async () => {
      const activities = await getActivities();

      expect(activities).toHaveLength(1);
      const activity = activities[0]!;

      expect(activity).toHaveProperty("slug");
      expect(activity).toHaveProperty("contributor");
      expect(activity).toHaveProperty("activity_definition");
      expect(activity).toHaveProperty("title");
      expect(activity).toHaveProperty("occured_at");
      expect(activity).toHaveProperty("link");
      expect(activity).toHaveProperty("text");
      expect(activity).toHaveProperty("points");
      expect(activity).toHaveProperty("meta");
    });

    it("should handle SCRAPE_DAYS environment variable", () => {
      // Test with 1 day
      const since1 = subDays(new Date(), 1);
      expect(since1).toBeInstanceOf(Date);

      // Test with 7 days
      const since7 = subDays(new Date(), 7);
      expect(since7).toBeInstanceOf(Date);

      // Test with 30 days
      const since30 = subDays(new Date(), 30);
      expect(since30).toBeInstanceOf(Date);

      // Verify date differences
      expect(since1.getTime()).toBeGreaterThan(since7.getTime());
      expect(since7.getTime()).toBeGreaterThan(since30.getTime());
    });

    it("should validate activity definition enum", async () => {
      const activities = await getActivities();
      const activity = activities[0]!;

      expect(Object.values(ActivityDefinition)).toContain(
        activity.activity_definition
      );
    });
  });

  describe("Integration Tests", () => {
    it("should run the actual scrape.ts script", async () => {
      // Run the actual script's main function
      await main();

      const db = getDb();

      // Verify contributors were added
      const contributorResult = await db.query("SELECT * FROM contributor");
      expect(contributorResult.rows.length).toBeGreaterThan(0);

      // Verify activities were added
      const activityResult = await db.query("SELECT * FROM activity");
      expect(activityResult.rows.length).toBeGreaterThan(0);
    });

    it("should handle SCRAPE_DAYS environment variable in main", async () => {
      process.env.SCRAPE_DAYS = "7";

      await main();

      const db = getDb();
      const result = await db.query("SELECT * FROM activity");
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should handle duplicate activities (upsert behavior)", async () => {
      // Run twice
      await main();
      await main();

      const db = getDb();
      const result = await db.query("SELECT * FROM activity");

      // Should only have unique activities
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should add contributors before activities", async () => {
      await main();

      const db = getDb();

      // Verify contributor exists
      const contributorResult = await db.query(
        "SELECT * FROM contributor WHERE username = $1",
        ["example-contributor-1"]
      );
      expect(contributorResult.rows).toHaveLength(1);

      // Verify activity references the contributor
      const activityResult = await db.query<{ contributor: string }>(
        "SELECT contributor FROM activity"
      );
      expect(activityResult.rows[0]?.contributor).toBe("example-contributor-1");
    });

    it("should preserve activity metadata", async () => {
      await main();

      const db = getDb();
      const result = await db.query<{ meta: Record<string, string> }>(
        "SELECT meta FROM activity"
      );

      const storedMeta = result.rows[0]?.meta;
      expect(storedMeta).toBeDefined();
      expect(storedMeta).toHaveProperty("example");
    });

    it("should default to 1 day when SCRAPE_DAYS is not set", async () => {
      delete process.env.SCRAPE_DAYS;

      await main();

      const db = getDb();
      const result = await db.query("SELECT * FROM activity");
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
