import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { createTestDb, seedBaseData } from "~/test/setup";
import { readInstructorAnalytics } from "../server";

// Upper bounds for complete reports against a real SQLite database. Empty
// activity must not cause unnecessary attribution or enrichment queries.
// A cheaper implementation is welcome: these are ceilings, not exact counts.
describe("analytics database query budgets", () => {
  let db: ReturnType<typeof createTestDb>;
  let base: ReturnType<typeof seedBaseData>;
  let queryCount: number;

  beforeEach(() => {
    const database = createTestDb();
    base = seedBaseData(database);
    queryCount = 0;
    db = drizzle(database.$client, {
      schema,
      logger: {
        logQuery() {
          queryCount += 1;
        },
      },
    });
  });

  afterEach(() => db.$client.close());

  it.each([
    { view: "instructor overview", isAdmin: false, course: false, budget: 11 },
    { view: "empty course", isAdmin: false, course: true, budget: 17 },
    { view: "platform overview", isAdmin: true, course: false, budget: 11 },
  ])(
    "bounds database work for the $view with no activity",
    ({ isAdmin, course, budget }) => {
      const report = readInstructorAnalytics(
        {
          viewer: { userId: base.instructor.id, isAdmin },
          selection: {
            range: "all",
            tab: course ? "course" : "overview",
            requestedInstructorId: null,
            requestedCourseId: course ? base.course.id : null,
          },
        },
        { db, now: new Date("2026-06-15T12:00:00.000Z") }
      );

      expect(report.summary.purchaseCount).toBe(0);
      expect(queryCount).toBeLessThanOrEqual(budget);
    }
  );
});
