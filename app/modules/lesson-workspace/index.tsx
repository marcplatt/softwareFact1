import { useFetcher } from "react-router";
import { LockKeyhole, MessageSquare, NotebookPen } from "lucide-react";
import { CommentThread } from "~/components/comment-thread";
import type { ComponentProps } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatRelativeTime } from "~/lib/utils";

type Note = { body: string; updatedAt: string } | null;

export function LessonWorkspace({
  note,
  ...discussion
}: ComponentProps<typeof CommentThread> & { note: Note }) {
  if (!discussion.currentUserId) return <CommentThread {...discussion} />;

  return (
    <section aria-label="Lesson workspace" className="mb-8 border-t pt-6">
      <Tabs defaultValue="notes">
        <TabsList aria-label="Lesson workspace">
          <TabsTrigger value="notes">
            <NotebookPen /> Your notes
          </TabsTrigger>
          <TabsTrigger value="discussion">
            <MessageSquare /> Discussion
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="notes"
          forceMount
          className="pt-4 data-[state=inactive]:hidden"
        >
          <LessonNote note={note} />
        </TabsContent>
        <TabsContent
          value="discussion"
          forceMount
          className="pt-4 data-[state=inactive]:hidden"
        >
          <CommentThread {...discussion} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function LessonNote({ note }: { note: Note }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  return (
    <fetcher.Form method="post" className="space-y-4">
      <div>
        <label htmlFor="lesson-note" className="font-semibold">
          Your notes
        </label>
        <p
          id="note-privacy"
          className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <LockKeyhole className="size-3.5" /> Private to you. Capture ideas and
          takeaways from this lesson.
        </p>
      </div>
      <input type="hidden" name="intent" value="save-note" />
      <Textarea
        id="lesson-note"
        aria-describedby="note-privacy"
        name="body"
        rows={6}
        defaultValue={note?.body ?? ""}
        placeholder="What would you like to remember?"
        className="min-h-40 resize-y bg-muted/20 leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <output className="text-xs text-muted-foreground">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : note ? (
            <span suppressHydrationWarning>
              Last edited {formatRelativeTime(note.updatedAt)}
            </span>
          ) : (
            "Your notes are only visible to you."
          )}
        </output>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save notes"}
        </Button>
      </div>
    </fetcher.Form>
  );
}
