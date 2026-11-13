import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { purchases } from "~/db/schema";
import { createTestDb, seedBaseData } from "~/test/setup";
import { readInstructorAnalytics } from "../server";

// Refund eligibility uses the server's local calendar. Run these tests in UTC
// and America/Vancouver to cover the same interface across DST changes.
describe("Instructor analytics Refund exposure", () => {
  let db: ReturnType<typeof createTestDb>;
  let base: ReturnType<typeof seedBaseData>;

  beforeEach(() => {
    db = createTestDb();
    base = seedBaseData(db);
  });

  afterEach(() => {
    db.$client.close();
  });

  function buy(at: Date, amountPaid = 10000) {
    db.insert(purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid,
        createdAt: at.toISOString(),
      })
      .run();
  }

  function exposure(now: Date) {
    return readInstructorAnalytics(
      {
        viewer: { userId: base.instructor.id, isAdmin: false },
        selection: {
          range: "all",
          tab: "overview",
          requestedInstructorId: null,
          requestedCourseId: null,
        },
      },
      { db, now }
    ).refundExposure;
  }

  it("keeps a Purchase exposed through its fourteenth local calendar day", () => {
    buy(new Date(2026, 5, 1, 23, 45));

    expect(exposure(new Date(2026, 5, 15, 23, 59, 59, 999))).toMatchObject({
      grossCents: 10000,
      netCents: 8000,
      purchaseCount: 1,
      sharePercent: 100,
      closingTodayCount: 1,
      courses: [{ courseId: base.course.id, daysLeft: 0 }],
    });
  });

  it("removes a Purchase from exposure at the following local midnight", () => {
    buy(new Date(2026, 5, 1, 23, 45));

    expect(exposure(new Date(2026, 5, 16, 0, 0))).toEqual({
      grossCents: 0,
      netCents: 0,
      purchaseCount: 0,
      sharePercent: 0,
      closingTodayCount: 0,
      courses: [],
    });
  });

  it("uses the earliest deadline per course and counts only Purchases closing today", () => {
    buy(new Date(2026, 5, 1, 23, 45), 10000);
    buy(new Date(2026, 5, 5, 12), 5000);
    buy(new Date(2026, 4, 31, 12), 5000);

    expect(exposure(new Date(2026, 5, 15, 12))).toEqual({
      grossCents: 15000,
      netCents: 12000,
      purchaseCount: 2,
      sharePercent: 75,
      closingTodayCount: 1,
      courses: [
        {
          courseId: base.course.id,
          title: base.course.title,
          grossCents: 15000,
          purchaseCount: 2,
          daysLeft: 0,
        },
      ],
    });
  });

  it.each([
    {
      season: "spring",
      purchasedAt: new Date(2026, 1, 28, 23, 30),
      finalDay: new Date(2026, 2, 14, 12),
      followingDay: new Date(2026, 2, 15, 0),
    },
    {
      season: "autumn",
      purchasedAt: new Date(2026, 9, 25, 23, 30),
      finalDay: new Date(2026, 10, 8, 12),
      followingDay: new Date(2026, 10, 9, 0),
    },
  ])(
    "counts calendar days across the $season daylight-saving change",
    ({ purchasedAt, finalDay, followingDay }) => {
      buy(purchasedAt);

      expect(exposure(finalDay)).toMatchObject({
        purchaseCount: 1,
        closingTodayCount: 1,
        courses: [{ daysLeft: 0 }],
      });
      expect(exposure(followingDay)).toMatchObject({
        purchaseCount: 0,
        closingTodayCount: 0,
        courses: [],
      });
    }
  );
});
