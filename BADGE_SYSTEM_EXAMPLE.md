# Badge System Example

This template includes a complete example of how to implement a badge system in your scraper. The example demonstrates the "Engagement Champion" badge, which is awarded based on activity count.

## Overview

The badge system allows you to recognize and reward contributors for their achievements. Badges can have multiple variants (e.g., Bronze, Silver, Gold) to represent different levels of achievement.

## Example Badge: Engagement Champion

**Name:** Engagement Champion  
**Slug:** `engagement_champion`  
**Description:** Awarded for active participation and consistent engagement in the community

### Variants

| Variant | Description | Requirement | Activities Needed |
|---------|-------------|-------------|-------------------|
| bronze | Bronze | Complete 10 activities | 10 |
| silver | Silver | Complete 50 activities | 50 |
| gold | Gold | Complete 100 activities | 100 |
| platinum | Platinum | Complete 500 activities | 500 |
| diamond | Diamond | Complete 1000 activities | 1000 |

## Implementation Guide

### 1. Define Badge Types

Add badge interfaces to `types/db.ts`:

```typescript
export interface BadgeVariant {
  description: string;
  svg_url: string;
  requirement?: string | null;
}

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  variants: Record<string, BadgeVariant>;
}

export interface ContributorBadge {
  slug: string; // Format: {badge}__{contributor}__{variant}
  badge: string; // FK to badge_definition.slug
  contributor: string; // FK to contributor.username
  variant: string;
  achieved_on: Date;
  meta: Record<string, unknown> | null;
}
```

### 2. Add Database Functions

Add to `lib/db.ts`:

```typescript
// Upsert badge definition
export async function upsertBadgeDefinition(definition: BadgeDefinition)

// Award badges to contributors
export async function upsertContributorBadges(badges: ContributorBadge[])

// Get activity counts (or any metric you want to base badges on)
export async function getActivityCounts()
```

### 3. Setup Badge Definition

In `scripts/prepare.ts`, define your badge:

```typescript
await upsertBadgeDefinition({
  slug: "engagement_champion",
  name: "Engagement Champion",
  description: "Awarded for active participation...",
  variants: {
    bronze: {
      description: "Bronze - 10 activities",
      svg_url: "/badges/engagement-bronze.svg",
      requirement: "Complete 10 activities",
    },
    // ... more variants
  },
});
```

### 4. Award Badges

In `scripts/pre-build.ts`, implement badge awarding logic:

```typescript
async function awardEngagementChampionBadges() {
  // 1. Get metrics (e.g., activity counts)
  const activityCounts = await getActivityCounts();
  
  // 2. Define thresholds
  const thresholds = [
    { variant: "bronze", required: 10 },
    { variant: "silver", required: 50 },
    // ... more thresholds
  ];
  
  // 3. Check which badges to award
  const badgesToAward: ContributorBadge[] = [];
  for (const [contributor, { count, first_activity_at }] of activityCounts.entries()) {
    for (const threshold of thresholds) {
      if (count >= threshold.required) {
        badgesToAward.push({
          slug: `engagement_champion__${contributor}__${threshold.variant}`,
          badge: "engagement_champion",
          contributor,
          variant: threshold.variant,
          achieved_on: first_activity_at,
          meta: {
            activity_count: count,
            threshold: threshold.required,
            awarded_by: "automated",
          },
        });
      }
    }
  }
  
  // 4. Award all badges
  await upsertContributorBadges(badgesToAward);
}
```

### 5. Export Badges

In `scripts/export.ts`, export badges to JSON files:

```typescript
// Query badges
const badgesResult = await db.query<ContributorBadge>(
  `SELECT * FROM contributor_badge WHERE badge = 'engagement_champion'`
);

// Group by contributor
const badgesByContributor = new Map<string, ContributorBadge[]>();
for (const badge of badges) {
  // ... grouping logic
}

// Write to data/<scraper-name>/badges/{username}.json
for (const [contributor, contributorBadges] of badgesByContributor) {
  const filePath = join(badgesOutputDir, `${contributor}.json`);
  await writeFile(filePath, JSON.stringify(contributorBadges, null, 2));
}
```

### 6. Import Badges

In `scripts/import.ts`, import badges from JSON files:

```typescript
// Read from data/<scraper-name>/badges/{username}.json
const badgesInputDir = join(flatDataPath, "data", "<scraper-name>", "badges");
const badgeJsonFiles = (await readdir(badgesInputDir))
  .filter((file) => file.endsWith(".json"));

// Parse all badge files
const allBadges: ContributorBadge[] = [];
for (const file of badgeJsonFiles) {
  const content = await readFile(join(badgesInputDir, file), "utf-8");
  const badges = JSON.parse(content) as ContributorBadge[];
  
  // Convert date strings back to Date objects
  for (const badge of badges) {
    badge.achieved_on = new Date(badge.achieved_on);
  }
  
  allBadges.push(...badges);
}

// Import to database
await upsertContributorBadges(allBadges);
```

## Customizing for Your Scraper

### Step 1: Choose Your Badge Criteria

Decide what achievement you want to recognize:
- **Activity-based**: Total activities, specific activity types
- **Time-based**: Consecutive days, weeks, months
- **Quality-based**: High-value contributions, reviews
- **Milestone-based**: First contribution, 100th contribution

### Step 2: Define Your Badge

Replace the example badge with your own:

```typescript
await upsertBadgeDefinition({
  slug: "your_badge_slug",
  name: "Your Badge Name",
  description: "Your badge description",
  variants: {
    variant1: {
      description: "Level 1 description",
      svg_url: "/badges/your-badge-level1.svg",
      requirement: "What's needed to earn this",
    },
    // ... more variants
  },
});
```

### Step 3: Implement Awarding Logic

Create a function to award your badge:

```typescript
async function awardYourBadge() {
  // 1. Query your metric
  const db = getDb();
  const result = await db.query(`
    SELECT contributor, COUNT(*) as metric_value
    FROM your_table
    WHERE your_conditions
    GROUP BY contributor
  `);
  
  // 2. Define thresholds
  const thresholds = [
    { variant: "level1", required: 10 },
    { variant: "level2", required: 50 },
  ];
  
  // 3. Award badges
  const badgesToAward: ContributorBadge[] = [];
  for (const row of result.rows) {
    for (const threshold of thresholds) {
      if (row.metric_value >= threshold.required) {
        badgesToAward.push({
          slug: `your_badge_slug__${row.contributor}__${threshold.variant}`,
          badge: "your_badge_slug",
          contributor: row.contributor,
          variant: threshold.variant,
          achieved_on: new Date(), // or use a relevant date
          meta: {
            metric_value: row.metric_value,
            threshold: threshold.required,
            awarded_by: "automated",
          },
        });
      }
    }
  }
  
  await upsertContributorBadges(badgesToAward);
}
```

### Step 4: Update Export Query

Update the export query to include your badge:

```typescript
const badgesResult = await db.query<ContributorBadge>(
  `SELECT * FROM contributor_badge WHERE badge = 'your_badge_slug'`
);
```

Or export all badges:

```typescript
const badgesResult = await db.query<ContributorBadge>(
  `SELECT * FROM contributor_badge`
);
```

## File Structure

```
data/
└── <scraper-name>/
    ├── activities/
    │   ├── user1.json
    │   ├── user2.json
    │   └── ...
    └── badges/
        ├── user1.json  # Badge data per contributor
        ├── user2.json
        └── ...
```

## Badge Data Format

Each badge JSON file contains an array of badges for that contributor:

```json
[
  {
    "slug": "engagement_champion__john_doe__bronze",
    "badge": "engagement_champion",
    "contributor": "john_doe",
    "variant": "bronze",
    "achieved_on": "2024-01-15",
    "meta": {
      "activity_count": 25,
      "threshold": 10,
      "awarded_by": "automated"
    }
  },
  {
    "slug": "engagement_champion__john_doe__silver",
    "badge": "engagement_champion",
    "contributor": "john_doe",
    "variant": "silver",
    "achieved_on": "2024-01-15",
    "meta": {
      "activity_count": 25,
      "threshold": 50,
      "awarded_by": "automated"
    }
  }
]
```

## Best Practices

### 1. Use Efficient Queries

Always use GROUP BY queries to get metrics for all contributors at once:

```typescript
// ✅ Good: Single query
SELECT contributor, COUNT(*) as count
FROM activity
GROUP BY contributor

// ❌ Bad: N queries
for (const contributor of contributors) {
  SELECT COUNT(*) FROM activity WHERE contributor = ?
}
```

### 2. Use ON CONFLICT DO NOTHING

This makes badge awarding idempotent:

```sql
INSERT INTO contributor_badge (...)
VALUES (...)
ON CONFLICT (slug) DO NOTHING;
```

Benefits:
- Safe to run multiple times
- Won't overwrite achievement dates
- Won't change metadata
- Only awards new badges

### 3. Store Meaningful Metadata

Include context about how the badge was earned:

```typescript
meta: {
  activity_count: 150,        // Current metric value
  threshold: 100,             // Threshold for this variant
  awarded_by: "automated",    // How it was awarded
  date_range: "2024-01-01 to 2024-12-31", // Optional context
}
```

### 4. Use Appropriate Achievement Dates

Choose a meaningful date:
- First activity date (for milestone badges)
- Date threshold was reached (if tracking)
- Current date (for time-based badges)

### 5. Batch Operations

Award all badges in a single operation:

```typescript
// ✅ Good: Batch award
const allBadges = [...];
await upsertContributorBadges(allBadges);

// ❌ Bad: Individual awards
for (const badge of badges) {
  await upsertContributorBadges([badge]);
}
```

## Multiple Badge Types

You can define multiple badge types in your scraper:

```typescript
// In prepare.ts
await upsertBadgeDefinition({
  slug: "engagement_champion",
  // ... engagement badge
});

await upsertBadgeDefinition({
  slug: "quality_contributor",
  // ... quality badge
});

// In pre-build.ts
await awardEngagementChampionBadges();
await awardQualityContributorBadges();

// In export.ts
const engagementBadges = await db.query(
  `SELECT * FROM contributor_badge WHERE badge = 'engagement_champion'`
);
const qualityBadges = await db.query(
  `SELECT * FROM contributor_badge WHERE badge = 'quality_contributor'`
);
// Or just export all badges at once
```

## Testing

To test your badge implementation:

```bash
# 1. Setup database and badge definitions
PGLITE_DB_PATH=./test-db tsx scripts/prepare.ts

# 2. Import some test data
PGLITE_DB_PATH=./test-db LEADERBOARD_DATA_PATH=./test-data tsx scripts/import.ts

# 3. Award badges
PGLITE_DB_PATH=./test-db tsx scripts/pre-build.ts

# 4. Check results
# Query the database to see awarded badges
# Or export and check the JSON files
PGLITE_DB_PATH=./test-db LEADERBOARD_DATA_PATH=./test-data tsx scripts/export.ts
cat test-data/data/<scraper-name>/badges/*.json
```

## Common Badge Ideas

### Activity-Based Badges
- **Engagement Champion**: Total activity count
- **Specialist**: Activities in specific category
- **Versatile Contributor**: Activities across multiple categories

### Time-Based Badges
- **Consistent Contributor**: Activities over consecutive days/weeks
- **Long-term Member**: Time since first contribution
- **Weekend Warrior**: Activities on weekends

### Quality-Based Badges
- **High Impact**: Activities with high point values
- **Helpful**: Activities that help others
- **Detailed**: Activities with extensive descriptions

### Milestone Badges
- **First Steps**: First activity
- **Centurion**: 100th activity
- **Veteran**: 1000th activity

### Social Badges
- **Team Player**: Collaborative activities
- **Mentor**: Helping other contributors
- **Community Builder**: Bringing people together

## Troubleshooting

### No badges awarded

Check if there's data:
```sql
SELECT COUNT(*) FROM activity;
```

Check if thresholds are appropriate:
```sql
SELECT contributor, COUNT(*) as count
FROM activity
GROUP BY contributor
ORDER BY count DESC;
```

### Badges not exporting

Verify badges exist:
```sql
SELECT COUNT(*) FROM contributor_badge WHERE badge = 'your_badge_slug';
```

### Import shows 0 new badges

This is expected if badges already exist. The system uses `ON CONFLICT DO NOTHING`.

## Summary

The badge system in this template provides:

✅ **Complete Example**: Engagement Champion badge based on activity count  
✅ **Efficient Queries**: Single GROUP BY query for all contributors  
✅ **Idempotent Operations**: Safe to run multiple times  
✅ **Flexible Structure**: Easy to customize for your needs  
✅ **Well-documented**: Clear examples and best practices  
✅ **Export/Import**: Full integration with data pipeline  

You can use this as a starting point and customize it for your specific scraper's needs!

