import { AlertTriangle } from "lucide-react";
import { isRouteErrorResponse, Link } from "react-router";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/courses.$slug.lessons.$lessonId";

import { FullLesson } from "~/components/lesson-full";
import { LockedLesson } from "~/components/lesson-locked";
import { loadLesson, saveLesson } from "~/modules/lesson-viewer/index.server";
export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson?.title ?? "Lesson";
  const courseTitle = loaderData?.course?.title ?? "Course";
  return [{ title: `${title} — ${courseTitle} — Cadence` }];
}

export function loader(args: Route.LoaderArgs) {
  return loadLesson(args);
}
export function action(args: Route.ActionArgs) {
  return saveLesson(args);
}
export default function LessonViewer({ loaderData }: Route.ComponentProps) {
  if (loaderData.view === "locked") {
    return <LockedLesson data={loaderData} />;
  }
  return <FullLesson data={loaderData} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this lesson.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Lesson not found";
      message =
        "The lesson you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/dashboard">
            <Button>My Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
