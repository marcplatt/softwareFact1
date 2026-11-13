import { afterEach, expect, it, vi } from "vitest";
import { db } from "~/db";
import { purchases } from "~/db/schema";
import { seedBaseData } from "~/test/setup";
import { readInstructorAnalytics } from "../server";

vi.mock("~/db", async () => {
  const { createTestDb } = await import("~/test/setup");
  return { db: createTestDb() };
});

afterEach(() => {
  vi.useRealTimers();
  db.$client.close();
});

it("uses the application database and current clock when dependencies are omitted", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  const base = seedBaseData(db);
  db.insert(purchases)
    .values({
      userId: base.user.id,
      courseId: base.course.id,
      amountPaid: 12345,
      createdAt: "2026-06-15T11:00:00.000Z",
    })
    .run();

  const report = readInstructorAnalytics({
    viewer: { userId: base.instructor.id, isAdmin: false },
    selection: {
      range: "7d",
      tab: "overview",
      requestedInstructorId: null,
      requestedCourseId: null,
    },
  });

  expect(report.summary.grossCents).toBe(12345);
  expect(report.series.points.at(-1)).toEqual({
    bucket: "2026-06-15",
    grossCents: 12345,
    netCents: 9876,
  });
});
