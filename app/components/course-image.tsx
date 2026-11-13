import { useState } from "react";
import { resolveCourseArtwork } from "~/modules/course-artwork";
import { BookOpen } from "lucide-react";

export function CourseImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const artworkSrc = resolveCourseArtwork(src, alt);

  if (!artworkSrc || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className ?? ""}`}
      >
        <BookOpen className="size-10 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <img
      src={artworkSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
