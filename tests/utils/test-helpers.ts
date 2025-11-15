import { PGlite } from "@electric-sql/pglite";
import { Activity, ActivityDefinition } from "@/types/db";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { resetDbInstance } from "@/lib/db";

/**
 * Setup test environment with in-memory database
 */
export function setupTestEnv(): void {
  process.env.PGLITE_DB_PATH = ":memory:";
  resetDbInstance();
}

/**
 * Create an isolated in-memory PGlite database instance with schema
 */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();

  // Create the schema
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

  return db;
}

/**
 * Create a temporary directory for file operations
 */
export async function createTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "leaderboard-test-"));
}

/**
 * Remove a temporary directory and all its contents
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
    console.warn(`Failed to cleanup temp dir ${dirPath}:`, error);
  }
}

/**
 * Generate a mock activity for testing
 */
export function createMockActivity(overrides?: Partial<Activity>): Activity {
  const timestamp = new Date();
  return {
    slug: `test-activity-${timestamp.getTime()}-${Math.random()}`,
    contributor: "test-contributor",
    activity_definition: ActivityDefinition.EXAMPLE_ACTIVITY,
    title: "Test Activity",
    occured_at: timestamp,
    link: "https://example.com",
    text: "Test activity text",
    points: 0,
    meta: { test: "data" },
    ...overrides,
  };
}

/**
 * Generate multiple mock activities for testing
 */
export function createMockActivities(
  count: number,
  overrides?: Partial<Activity>
): Activity[] {
  return Array.from({ length: count }, (_, i) =>
    createMockActivity({
      slug: `test-activity-${Date.now()}-${i}`,
      ...overrides,
    })
  );
}

/**
 * Insert activity definitions into the test database
 */
export async function insertActivityDefinitions(db: PGlite): Promise<void> {
  await db.query(`
    INSERT INTO activity_definition (slug, name, description, points, icon)
    VALUES 
      ('${ActivityDefinition.EXAMPLE_ACTIVITY}', 'Example Activity', 'Example Activity', 0, 'message-circle')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, points = EXCLUDED.points, icon = EXCLUDED.icon;
  `);
}

/**
 * Insert a contributor into the test database
 */
export async function insertContributor(
  db: PGlite,
  username: string
): Promise<void> {
  await db.query(
    `
    INSERT INTO contributor (username, avatar_url)
    VALUES ($1, $2)
    ON CONFLICT (username) DO NOTHING;
  `,
    [username, `https://gravatar.com/avatar/${username}`]
  );
}

/**
 * Insert an activity into the test database
 */
export async function insertActivity(
  db: PGlite,
  activity: Activity
): Promise<void> {
  await db.query(
    `
    INSERT INTO activity (slug, contributor, activity_definition, title, occured_at, link, text, points, meta)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (slug) DO UPDATE SET 
      contributor = EXCLUDED.contributor, 
      activity_definition = EXCLUDED.activity_definition, 
      title = EXCLUDED.title, 
      occured_at = EXCLUDED.occured_at, 
      link = EXCLUDED.link;
  `,
    [
      activity.slug,
      activity.contributor,
      activity.activity_definition,
      activity.title,
      activity.occured_at.toISOString(),
      activity.link,
      activity.text,
      activity.points ?? null,
      activity.meta ? JSON.stringify(activity.meta) : null,
    ]
  );
}
