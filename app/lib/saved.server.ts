import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules, notes } from "~/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

export const saveNoteSchema = z.object({
  body: z.string().trim().max(2000, "Notes must be 2,000 characters or fewer."),
});

// Callers enforce content access before reading or changing a Lesson's saved data.
export function getLessonSaved(db: Db, userId: number, lessonId: number) {
  const ownerLesson = and(
    eq(bookmarks.userId, userId),
    eq(bookmarks.lessonId, lessonId)
  );
  return {
    bookmarked: !!db.select().from(bookmarks).where(ownerLesson).get(),
    note:
      db
        .select()
        .from(notes)
        .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
        .get() ?? null,
  };
}

export function toggleBookmark(
  db: Db,
  userId: number,
  lessonId: number,
  now: Date
) {
  return db.transaction(() => {
    const existing = db
      .select()
      .from(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId))
      )
      .get();
    if (existing) {
      db.delete(bookmarks).where(eq(bookmarks.id, existing.id)).run();
      return false;
    }
    db.insert(bookmarks)
      .values({ userId, lessonId, createdAt: now.toISOString() })
      .run();
    return true;
  });
}

export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
) {
  const parsed = saveNoteSchema.parse({ body });
  if (!parsed.body) {
    db.delete(notes)
      .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
      .run();
    return;
  }
  db.insert(notes)
    .values({
      userId,
      lessonId,
      body: parsed.body,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: parsed.body, updatedAt: now.toISOString() },
    })
    .run();
}

// Only query Note bodies for courses the caller has authorized for this Student.
export function listSaved(
  db: Db,
  userId: number,
  accessibleCourseIds: number[]
) {
  if (!accessibleCourseIds.length)
    return { savedBookmarks: [], savedNotes: [] };
  const lessonRef = {
    lessonId: lessons.id,
    lessonTitle: lessons.title,
    moduleTitle: modules.title,
    courseTitle: courses.title,
    courseSlug: courses.slug,
  };
  const savedBookmarks = db
    .select({ id: bookmarks.id, createdAt: bookmarks.createdAt, ...lessonRef })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(
        eq(bookmarks.userId, userId),
        inArray(courses.id, accessibleCourseIds)
      )
    )
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .all();
  const savedNotes = db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      ...lessonRef,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(eq(notes.userId, userId), inArray(courses.id, accessibleCourseIds))
    )
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
  return { savedBookmarks, savedNotes };
}
