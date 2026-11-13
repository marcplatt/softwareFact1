import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { readInstructorAnalytics } from "../server";

const NOW = new Date("2026-06-15T12:00:00.000Z");
let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

afterEach(() => {
  db.$client.close();
});

function readReport(
  selection: {
    range?: "7d" | "30d" | "90d" | "all";
    tab?: "overview" | "course";
    requestedInstructorId?: number | null;
    requestedCourseId?: number | null;
  } = {},
  viewer = { userId: base.instructor.id, isAdmin: false }
) {
  return readInstructorAnalytics(
    {
      viewer,
      selection: {
        range: "7d",
        tab: "overview",
        requestedInstructorId: null,
        requestedCourseId: null,
        ...selection,
      },
    },
    { db, now: NOW }
  );
}

function buy(
  courseId: number,
  amountPaid: number,
  createdAt = "2026-06-14T12:00:00.000Z"
) {
  return db
    .insert(schema.purchases)
    .values({
      userId: base.user.id,
      courseId,
      amountPaid,
      createdAt,
    })
    .returning()
    .get();
}

function addOtherInstructorCourse() {
  const instructor = db
    .insert(schema.users)
    .values({
      name: "Other Instructor",
      email: "other@example.com",
      role: schema.UserRole.Instructor,
    })
    .returning()
    .get();
  const course = db
    .insert(schema.courses)
    .values({
      title: "Other Course",
      slug: "other-course",
      description: "Another course",
      salesCopy: markdown("Other course"),
      instructorId: instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
  return { instructor, course };
}

describe("Instructor analytics reports", () => {
  it("returns usable empty figures for an Instructor with no sales", () => {
    const report = readReport();
    expect(report.summary).toEqual({
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
      purchaseCount: 0,
    });
    expect(report.audience).toEqual({
      buyerCount: 0,
      studentCount: 0,
      revenuePerStudentCents: null,
    });
    expect(report.ratings).toEqual({ average: null, count: 0 });
    expect(report.buyers).toEqual([]);
    expect(report.selectedCourseId).toBeNull();
    expect(report.progress).toBeNull();
  });

  it("pins an Instructor to their own figures despite another Instructor in the selection", () => {
    const other = addOtherInstructorCourse();
    buy(base.course.id, 10000);
    buy(other.course.id, 90000);

    const report = readReport({ requestedInstructorId: other.instructor.id });

    expect(report.instructorId).toBe(base.instructor.id);
    expect(report.summary).toEqual({
      grossCents: 10000,
      feeCents: 2000,
      netCents: 8000,
      purchaseCount: 1,
    });
    expect(report.courseOptions).toEqual([
      { courseId: base.course.id, title: base.course.title },
    ]);
    expect(report.courses).toEqual([
      {
        courseId: base.course.id,
        title: base.course.title,
        grossCents: 10000,
        feeCents: 2000,
        netCents: 8000,
        purchaseCount: 1,
      },
    ]);
    expect(report.instructors).toEqual([]);
  });

  it("lets a Platform Admin inspect all Instructors or one selected Instructor", () => {
    const other = addOtherInstructorCourse();
    const platformAdmin = db
      .insert(schema.users)
      .values({
        name: "Platform Admin",
        email: "platform-admin@example.com",
        role: schema.UserRole.Admin,
      })
      .returning()
      .get();
    buy(base.course.id, 10000);
    buy(other.course.id, 20000);
    const viewer = { userId: platformAdmin.id, isAdmin: true };

    const all = readReport({}, viewer);
    expect(all.instructorId).toBeNull();
    expect(all.summary).toEqual({
      grossCents: 30000,
      feeCents: 6000,
      netCents: 24000,
      purchaseCount: 2,
    });
    expect(all.instructors).toEqual([
      { id: other.instructor.id, name: other.instructor.name },
      { id: base.instructor.id, name: base.instructor.name },
    ]);

    const selected = readReport(
      { requestedInstructorId: other.instructor.id },
      viewer
    );
    expect(selected.summary).toEqual({
      grossCents: 20000,
      feeCents: 4000,
      netCents: 16000,
      purchaseCount: 1,
    });
    expect(selected.courseOptions).toEqual([
      { courseId: other.course.id, title: other.course.title },
    ]);
  });

  it("does not return a foreign course's detail panels to an Instructor", () => {
    const other = addOtherInstructorCourse();
    buy(other.course.id, 90000);

    const report = readReport({
      tab: "course",
      requestedCourseId: other.course.id,
    });

    expect(report.selectedCourseId).toBeNull();
    expect(report.progress).toBeNull();
    expect(report.funnel).toBeNull();
    expect(report.quizzes).toBeNull();
    expect(report.countries).toBeNull();
  });

  it("counts a Team Licence once while reporting all its Seats", () => {
    const purchase = buy(base.course.id, 3333);
    const team = db
      .insert(schema.teams)
      .values({ createdAt: "2026-06-14T12:00:00.000Z" })
      .returning()
      .get();
    db.insert(schema.coupons)
      .values(
        [1, 2, 3].map((seat) => ({
          teamId: team.id,
          courseId: base.course.id,
          purchaseId: purchase.id,
          code: `SEAT-${seat}`,
          createdAt: "2026-06-14T12:00:00.000Z",
        }))
      )
      .run();

    const report = readReport();

    expect(report.summary).toEqual({
      grossCents: 3333,
      feeCents: 667,
      netCents: 2666,
      purchaseCount: 1,
    });
    expect(report.buyers).toEqual([
      {
        userId: base.user.id,
        name: base.user.name,
        email: base.user.email,
        spendCents: 3333,
        purchaseCount: 1,
        seatsBought: 3,
        seatsUnredeemed: 3,
        enrolled: false,
      },
    ]);
    expect(report.audience).toEqual({
      buyerCount: 1,
      studentCount: 0,
      revenuePerStudentCents: null,
    });
  });

  it("includes the exact range cutoff and fills missing chart days through the supplied today", () => {
    buy(base.course.id, 10000, "2026-06-08T12:00:00.000Z");
    buy(base.course.id, 90000, "2026-06-08T11:59:59.999Z");
    buy(base.course.id, 20000, "2026-06-15T11:00:00.000Z");

    const report = readReport();

    expect(report.summary).toEqual({
      grossCents: 30000,
      feeCents: 6000,
      netCents: 24000,
      purchaseCount: 2,
    });
    expect(report.series).toEqual({
      granularity: "day",
      points: [
        { bucket: "2026-06-08", grossCents: 10000, netCents: 8000 },
        { bucket: "2026-06-09", grossCents: 0, netCents: 0 },
        { bucket: "2026-06-10", grossCents: 0, netCents: 0 },
        { bucket: "2026-06-11", grossCents: 0, netCents: 0 },
        { bucket: "2026-06-12", grossCents: 0, netCents: 0 },
        { bucket: "2026-06-13", grossCents: 0, netCents: 0 },
        { bucket: "2026-06-14", grossCents: 0, netCents: 0 },
        { bucket: "2026-06-15", grossCents: 20000, netCents: 16000 },
      ],
    });
    expect(report.buyers[0]).toMatchObject({
      spendCents: 30000,
      purchaseCount: 2,
    });
  });

  it("keeps progress and the funnel all-time while filtering quiz attempts and Purchases by range", () => {
    const courseModule = db
      .insert(schema.modules)
      .values({
        courseId: base.course.id,
        title: "Basics",
        position: 1,
      })
      .returning()
      .get();
    const lesson = db
      .insert(schema.lessons)
      .values({
        moduleId: courseModule.id,
        title: "First Lesson",
        position: 1,
      })
      .returning()
      .get();
    const quiz = db
      .insert(schema.quizzes)
      .values({
        lessonId: lesson.id,
        title: "First Quiz",
        passingScore: 0.7,
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        enrolledAt: "2026-05-01T12:00:00.000Z",
      })
      .run();
    db.insert(schema.lessonProgress)
      .values({
        userId: base.user.id,
        lessonId: lesson.id,
        status: schema.LessonProgressStatus.Completed,
        completedAt: "2026-05-02T12:00:00.000Z",
      })
      .run();
    db.insert(schema.quizAttempts)
      .values([
        {
          userId: base.user.id,
          quizId: quiz.id,
          score: 1,
          passed: true,
          attemptedAt: "2026-05-02T12:00:00.000Z",
        },
        {
          userId: base.user.id,
          quizId: quiz.id,
          score: 0.5,
          passed: false,
          attemptedAt: "2026-06-14T12:00:00.000Z",
        },
      ])
      .run();
    buy(base.course.id, 90000, "2026-05-01T12:00:00.000Z");
    buy(base.course.id, 10000);

    const report = readReport({
      tab: "course",
      requestedCourseId: base.course.id,
    });

    expect(report.progress).toEqual({
      enrolledCount: 1,
      totalLessons: 1,
      averageProgressPercent: 100,
      finishedCount: 1,
    });
    expect(report.funnel).toEqual({
      enrolledCount: 1,
      modules: [
        {
          moduleId: courseModule.id,
          title: courseModule.title,
          reachedCount: 1,
          dropWithin: 0,
          lessons: [
            {
              lessonId: lesson.id,
              title: lesson.title,
              reachedCount: 1,
              dropFromPrevious: 0,
            },
          ],
        },
      ],
    });
    expect(report.quizzes).toEqual([
      {
        quizId: quiz.id,
        title: quiz.title,
        moduleTitle: courseModule.title,
        lessonTitle: lesson.title,
        passingScorePercent: 70,
        studentCount: 1,
        passedCount: 0,
        passRatePercent: 0,
        averageBestScorePercent: 50,
      },
    ]);
    expect(report.countries).toMatchObject({
      grossCents: 10000,
      purchaseCount: 1,
    });
  });
});
