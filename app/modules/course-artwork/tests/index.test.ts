import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolveCourseArtwork } from "../index";

const courses = [
  ["Introduction to TypeScript", "typescript"],
  ["Building REST APIs with Node.js", "nodejs"],
  ["Design Systems with Tailwind", "design-systems"],
  ["Practical Data Visualisation", "data-visualisation"],
  ["Shipping with Docker and Kubernetes", "containers"],
];

describe("course artwork", () => {
  it.each(courses)("resolves both legacy URLs for %s", (title, name) => {
    const expected = `/images/course-${name}.svg`;
    for (const src of [
      "/images/course-typescript.svg",
      "/images/course-nodejs.svg",
    ]) {
      expect(resolveCourseArtwork(src, title)).toBe(expected);
    }
    expect(existsSync(`public${expected}`)).toBe(true);
    expect(readFileSync(`public${expected}`, "utf8")).toContain(
      'viewBox="0 0 960 540"'
    );
  });

  it.each([
    null,
    undefined,
    "",
    "/custom.svg",
    "/images/course-containers.svg",
  ])("preserves a supplied or missing cover: %s", (src) => {
    expect(resolveCourseArtwork(src, "Design Systems with Tailwind")).toBe(src);
  });

  it.each(["/images/course-typescript.svg", "/images/course-nodejs.svg"])(
    "preserves an unknown course's legacy cover: %s",
    (src) => {
      expect(resolveCourseArtwork(src, "An instructor's new course")).toBe(src);
      expect(resolveCourseArtwork(src, "toString")).toBe(src);
    }
  );
});
