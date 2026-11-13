import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { LessonWorkspace } from "../index";

const request = vi.hoisted(() => ({
  state: "idle",
  data: undefined as undefined | { ok: boolean; error?: string },
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useFetcher: () => ({
    ...request,
    Form: (props: ComponentProps<"form">) => <form {...props} />,
  }),
}));

function render(note: { body: string; updatedAt: string } | null = null) {
  return renderToStaticMarkup(
    <LessonWorkspace
      note={note}
      comments={[]}
      currentUserId={5}
      canModerate={false}
      canPost
      instructorName="Sarah"
    />
  );
}

describe("Lesson workspace", () => {
  it("does not offer private notes when nobody is signed in", () => {
    const html = renderToStaticMarkup(
      <LessonWorkspace
        note={null}
        comments={[]}
        currentUserId={null}
        canModerate={false}
        canPost={false}
        instructorName="Sarah"
      />
    );
    expect(html).not.toContain("save-note");
    expect(html).not.toContain("Your notes");
    expect(html).toContain("Questions &amp; Discussion");
  });
  it("groups private notes and discussion in labelled tabs, with notes selected", () => {
    request.state = "idle";
    request.data = undefined;
    const html = render();
    expect(html).toContain('aria-label="Lesson workspace"');
    expect(html).toMatch(/aria-selected="true"[^>]*[\s\S]*?Your notes/);
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain("Discussion");
    expect(html).toContain("Private to you.");
    expect(html).toContain('aria-describedby="note-privacy"');
    expect(html).toContain('name="intent" value="save-note"');
    expect(html).toMatch(/<textarea[^>]*id="lesson-note"[^>]*><\/textarea>/);
    expect(html).toContain("Save notes");
    expect(html).toContain("Your notes are only visible to you.");
    // Both panels stay mounted so switching tabs preserves unsubmitted writing.
    expect(html).toContain("Questions &amp; Discussion");
    expect(html).toContain("data-[state=inactive]:hidden");
  });

  it("loads the saved note as text and shows its edit status", () => {
    const html = render({
      body: "Remember <generics>",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(html).toContain("Remember &lt;generics&gt;");
    expect(html).toContain("Last edited");
    expect(html).not.toContain("Your notes are only visible to you.");
  });

  it("disables saving while a request is in progress", () => {
    request.state = "submitting";
    const html = render();
    expect(html).toMatch(/disabled=""[^>]*>Saving\.\.\./);
    request.state = "idle";
  });

  it("announces save errors without a misleading edit status", () => {
    request.data = { ok: false, error: "Your note was not saved." };
    const html = render({ body: "Draft", updatedAt: "2026-01-01T00:00:00Z" });
    expect(html).toContain("<output");
    expect(html).toContain("Your note was not saved.");
    expect(html).not.toContain("Last edited");
    request.data = undefined;
  });
});
