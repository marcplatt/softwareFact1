const covers = new Map([
  ["Introduction to TypeScript", "/images/course-typescript.svg"],
  ["Building REST APIs with Node.js", "/images/course-nodejs.svg"],
  ["Design Systems with Tailwind", "/images/course-design-systems.svg"],
  ["Practical Data Visualisation", "/images/course-data-visualisation.svg"],
  ["Shipping with Docker and Kubernetes", "/images/course-containers.svg"],
]);

export function resolveCourseArtwork(
  src: string | null | undefined,
  title: string
): string | null | undefined {
  // Old seeded records share two URLs; preserve instructor-supplied covers.
  if (
    src === "/images/course-typescript.svg" ||
    src === "/images/course-nodejs.svg"
  ) {
    return covers.get(title) ?? src;
  }
  return src;
}
