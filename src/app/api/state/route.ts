import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { CRITERIA_TAGS, EVENT_CATEGORIES } from "@/lib/constants";
import {
  listClients,
  listEmailLogs,
  listEvents,
  listIngestionItems,
  listIngestionRuns,
  listReviewItems,
  listSourcePages,
  listSources,
} from "@/lib/repository";
import { listAssignmentsForAdmin, listMediaWriters } from "@/lib/mediaRepository";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const [
    events,
    clients,
    sources,
    sourcePages,
    emailLogs,
    ingestionRuns,
    ingestionItems,
    reviewItems,
    mediaAssignments,
    mediaWriters,
  ] = await Promise.all([
    listEvents(),
    listClients(),
    listSources(),
    listSourcePages(),
    listEmailLogs(),
    listIngestionRuns(),
    listIngestionItems(),
    listReviewItems(),
    user?.role === "admin" ? listAssignmentsForAdmin() : Promise.resolve([]),
    user?.role === "admin" ? listMediaWriters() : Promise.resolve([]),
  ]);

  return NextResponse.json({
    user,
    events,
    clients,
    sources,
    sourcePages,
    emailLogs,
    ingestionRuns,
    ingestionItems,
    reviewItems,
    mediaAssignments,
    mediaWriters,
    eventCategories: EVENT_CATEGORIES,
    criteriaTags: CRITERIA_TAGS,
  });
}
