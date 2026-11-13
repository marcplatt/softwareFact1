import { db } from "~/db";
import {
  readInstructorAnalytics as readReport,
  type AnalyticsDependencies,
  type AnalyticsRequest,
} from "./lib/report.server";

export type {
  RevenueSeries,
  CourseProgressSummary,
  FunnelLesson,
  CourseFunnel,
  QuizPassRate,
  CourseCountryRevenue,
  RefundExposure,
} from "./lib/report.server";

/** Reads a report for an authenticated viewer, using one clock instant. */
export function readInstructorAnalytics(
  request: AnalyticsRequest,
  dependencies: AnalyticsDependencies = { db, now: new Date() }
) {
  return readReport(dependencies, request);
}
