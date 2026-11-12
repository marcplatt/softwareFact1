import { beforeEach, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  getLessonSaved,
  listSaved,
  saveNote,
  toggleBookmark,
} from "./saved.server";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";

let db: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];
const NOW = new Date("2026-10-06T12:00:00.000Z");
const LATER = new Date("2026-10-06T13:00:00.000Z");

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

it("toggles a Bookmark on and off without duplicates", () => {
  expect(getLessonSaved(db, base.user.id, lessonIds[0])).toEqual({
    bookmarked: false,
    note: null,
  });
  expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
  expect(getLessonSaved(db, base.user.id, lessonIds[0]).bookmarked).toBe(true);
  expect(
    listSaved(db, base.user.id, [base.course.id]).savedBookmarks
  ).toHaveLength(1);
  expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(false);
  expect(listSaved(db, base.user.id, [base.course.id]).savedBookmarks).toEqual(
    []
  );
});

it("saves trimmed plain text, replacing a Note and advancing only its last edited time", () => {
  saveNote(
    db,
    base.user.id,
    lessonIds[0],
    "  # My thoughts\n*literally*  ",
    NOW
  );
  expect(getLessonSaved(db, base.user.id, lessonIds[0]).note).toMatchObject({
    body: "# My thoughts\n*literally*",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
  saveNote(db, base.user.id, lessonIds[0], "Replacement", LATER);
  expect(getLessonSaved(db, base.user.id, lessonIds[0]).note).toMatchObject({
    body: "Replacement",
    createdAt: NOW.toISOString(),
    updatedAt: LATER.toISOString(),
  });
  expect(listSaved(db, base.user.id, [base.course.id]).savedNotes).toHaveLength(
    1
  );
});

it("accepts 2,000 characters and rejects 2,001 without overwriting the Note", () => {
  saveNote(db, base.user.id, lessonIds[0], "a".repeat(2000), NOW);
  expect(() =>
    saveNote(db, base.user.id, lessonIds[0], "b".repeat(2001), LATER)
  ).toThrow("2,000 characters or fewer");
  expect(getLessonSaved(db, base.user.id, lessonIds[0]).note?.body).toBe(
    "a".repeat(2000)
  );
});

it("clears only the owning Student's Note when saving whitespace", () => {
  saveNote(db, base.user.id, lessonIds[0], "Mine", NOW);
  saveNote(db, base.instructor.id, lessonIds[0], "Someone else's", NOW);
  saveNote(db, base.user.id, lessonIds[0], " \n ", LATER);
  expect(getLessonSaved(db, base.user.id, lessonIds[0]).note).toBeNull();
  expect(getLessonSaved(db, base.instructor.id, lessonIds[0]).note?.body).toBe(
    "Someone else's"
  );
});

it("lists only the Student's rows newest first, with their Lesson and Course", () => {
  toggleBookmark(db, base.user.id, lessonIds[0], NOW);
  toggleBookmark(db, base.user.id, lessonIds[1], LATER);
  saveNote(db, base.user.id, lessonIds[0], "First", NOW);
  saveNote(db, base.user.id, lessonIds[1], "Second", LATER);
  toggleBookmark(db, base.instructor.id, lessonIds[0], LATER);
  saveNote(db, base.instructor.id, lessonIds[0], "Private", LATER);
  const saved = listSaved(db, base.user.id, [base.course.id]);
  expect(saved.savedBookmarks.map((row) => row.lessonTitle)).toEqual([
    "Lesson 2",
    "Lesson 1",
  ]);
  expect(saved.savedNotes.map((row) => row.body)).toEqual(["Second", "First"]);
  for (const row of [...saved.savedBookmarks, ...saved.savedNotes]) {
    expect(row).toMatchObject({
      courseTitle: "Test Course",
      courseSlug: "test-course",
      moduleTitle: "Basics",
    });
    expect(lessonIds).toContain(row.lessonId);
  }
  saveNote(
    db,
    base.user.id,
    lessonIds[0],
    "Edited first",
    new Date("2026-10-06T14:00:00.000Z")
  );
  expect(
    listSaved(db, base.user.id, [base.course.id]).savedNotes.map(
      (row) => row.body
    )
  ).toEqual(["Edited first", "Second"]);
});

it("excludes saved data for courses without content access", () => {
  toggleBookmark(db, base.user.id, lessonIds[0], NOW);
  saveNote(db, base.user.id, lessonIds[0], "Retained privately", NOW);
  expect(listSaved(db, base.user.id, [])).toEqual({
    savedBookmarks: [],
    savedNotes: [],
  });
  expect(listSaved(db, base.user.id, [-1])).toEqual({
    savedBookmarks: [],
    savedNotes: [],
  });
  expect(listSaved(db, base.user.id, [base.course.id]).savedNotes[0].body).toBe(
    "Retained privately"
  );
});

it("keeps Bookmarks and Notes after an Approved Refund Request so they return with renewed access", async () => {
  const purchase = db
    .insert(schema.purchases)
    .values({
      userId: base.user.id,
      courseId: base.course.id,
      amountPaid: 7900,
      createdAt: new Date("2026-10-05T12:00:00.000Z").toISOString(),
    })
    .returning()
    .get();
  db.insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
  toggleBookmark(db, base.user.id, lessonIds[0], NOW);
  saveNote(db, base.user.id, lessonIds[0], "Keep this", NOW);
  const notifications = fakeNotifications();
  const raised = await raiseRefundRequest(
    db,
    purchase.id,
    base.user.id,
    "Not for me",
    NOW,
    notifications
  );
  expect(raised.ok).toBe(true);
  if (!raised.ok) throw new Error(raised.error);
  const admin = db
    .insert(schema.users)
    .values({
      name: "Admin",
      email: "admin@example.com",
      role: schema.UserRole.Admin,
    })
    .returning()
    .get();
  expect(
    await approveRefundRequest(
      db,
      raised.refundRequestId,
      admin.id,
      null,
      LATER,
      notifications
    )
  ).toMatchObject({ ok: true });
  expect(listSaved(db, base.user.id, [])).toEqual({
    savedBookmarks: [],
    savedNotes: [],
  });
  // Simulate restored access by authorizing the Course again.
  const restored = listSaved(db, base.user.id, [base.course.id]);
  expect(restored.savedBookmarks).toHaveLength(1);
  expect(restored.savedNotes.map((note) => note.body)).toEqual(["Keep this"]);
});
