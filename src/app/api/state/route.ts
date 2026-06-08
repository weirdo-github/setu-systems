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
  ] = await Promise.all([
    listEvents(),
    listClients(),
    listSources(),
    listSourcePages(),
    listEmailLogs(),
    listIngestionRuns(),
    listIngestionItems(),
    listReviewItems(),
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
    eventCategories: EVENT_CATEGORIES,
    criteriaTags: CRITERIA_TAGS,
  });
}
