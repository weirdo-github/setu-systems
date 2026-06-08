import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isPushableClient, pushEligibilityReason } from "@/lib/engagement";
import { rankMatches } from "@/lib/matching";
import { listClients, listEvents, logRecommendation } from "@/lib/repository";

export async function GET(request: Request) {
  const { response } = await requireUser();
  if (response) return response;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const [clients, events] = await Promise.all([listClients(), listEvents()]);
  const client = clients.find((item) => item.id === clientId) ?? clients[0];

  if (!client) {
    return NextResponse.json({ client: null, matches: [], pushEligibility: null });
  }

  if (!isPushableClient(client)) {
    return NextResponse.json({
      client,
      matches: [],
      pushEligibility: {
        pushable: false,
        reason: pushEligibilityReason(client),
      },
    });
  }

  const matches = rankMatches(client, events);
  await Promise.all(
    matches.slice(0, 8).map((match) =>
      logRecommendation(client.id, match.event.id, match.score, match.breakdown),
    ),
  );

  return NextResponse.json({
    client,
    matches,
    pushEligibility: {
      pushable: true,
      reason: pushEligibilityReason(client),
    },
  });
}
