# Test Suite Documentation

This directory contains comprehensive unit and integration tests for the leaderboard scraper template.

## Overview

The test suite uses **Vitest** as the testing framework with the following features:
- In-memory PGlite database instances for isolated testing (via `PGLITE_DB_PATH=":memory:"`)
- Real temporary directories for file system operations
- **Tests the actual scripts**, not just the underlying functions
- Both unit and integration tests for all scripts
- 100% code coverage on core database functionality

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage
```

## Test Structure

### Test Utilities (`tests/utils/test-helpers.ts`)

Provides reusable test helpers:
- `setupTestEnv()` - Sets up environment for in-memory database testing
- `createTestDb()` - Creates isolated in-memory PGlite instance with schema
- `createTempDir()` - Creates temporary directory for file operations
- `cleanupTempDir()` - Removes temporary directory after tests
- `createMockActivity()` - Generates mock activity data
- `createMockActivities()` - Generates multiple mock activities
- `insertActivityDefinitions()` - Inserts activity definitions into test DB
- `insertContributor()` - Inserts a contributor into test DB
- `insertActivity()` - Inserts an activity into test DB

### Database Module Changes (`lib/db.ts`)

The database module now supports in-memory databases for testing:
- When `PGLITE_DB_PATH=":memory:"`, creates an in-memory PGlite instance
- `resetDbInstance()` function to reset the singleton instance between tests
- This allows tests to actually run the scripts with isolated databases

### Test Files

#### `prepare.test.ts` (7 tests)
Tests for the `prepare.ts` script that upserts activity definitions.

**Unit Tests:**
- Insert activity definitions correctly
- Idempotency (running twice doesn't duplicate)
- Update existing activity definitions
- Throw error when PGLITE_DB_PATH is not set

**Integration Tests:**
- Full prepare workflow execution
- Work with fresh database
- **Run the actual prepare.ts script's main function**

#### `scrape.test.ts` (9 tests)
Tests for the `scrape.ts` script that fetches and stores activities.

**Unit Tests:**
- Validate activity structure from getActivities
- Handle SCRAPE_DAYS environment variable
- Validate activity definition enum

**Integration Tests:**
- **Run the actual scrape.ts script's main function**
- Handle SCRAPE_DAYS environment variable in main
- Handle duplicate activities (upsert behavior)
- Add contributors before activities
- Preserve activity metadata
- Default to 1 day when SCRAPE_DAYS is not set

#### `export.test.ts` (4 tests)
Tests for the `export.ts` script that exports activities to JSON files.

**Integration Tests:**
- **Run the actual export.ts script's main function**
- Throw error when LEADERBOARD_DATA_PATH is not set
- Handle empty database
- Group activities by contributor

#### `import.test.ts` (7 tests)
Tests for the `import.ts` script that imports activities from JSON files.

**Integration Tests:**
- **Run the actual import.ts script's main function**
- Throw error when LEADERBOARD_DATA_PATH is not set
- Handle non-existent directory gracefully
- Handle empty directory (no JSON files)
- Import multiple contributor files
- Convert date strings to Date objects during import
- Preserve metadata during import

## Test Coverage

Current coverage: **100%** on core database functionality (`lib/db.ts`)

```
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |                   
 db.ts    |     100 |      100 |     100 |     100 |                   
----------|---------|----------|---------|---------|-------------------
```

## Testing Approach

### Database Testing
- Each test uses an isolated in-memory PGlite instance
- No cleanup needed between tests (fresh instance per test)
- Tests work directly with database functions to avoid mocking complexity

### File System Testing
- Real temporary directories created for each test
- Actual file I/O operations (no mocks)
- Cleanup performed after each test

### Test Patterns
- `beforeEach` creates fresh database and temp directories
- `afterEach` cleans up temp directories
- Descriptive test names: "should handle X when Y"
- Tests grouped with `describe` blocks
- Both success and error paths tested

## Notes

- The EPERM warnings during test cleanup are harmless and don't affect test results
- Tests use real file operations with temporary directories for better integration testing
- Database operations use in-memory PGlite for speed and isolation
- Large batch tests (1500-2500 activities) verify scalability

