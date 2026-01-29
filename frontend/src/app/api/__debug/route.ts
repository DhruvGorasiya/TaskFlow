export const runtime = "nodejs";

// Server-side log relay to avoid browser CORS issues.
// Forwards client logs to the debug ingest endpoint (writes to debug.log).

const INGEST =
  "http://127.0.0.1:7242/ingest/7cba70ce-b46b-404a-8c4b-820a762188e6";

export async function POST(req: Request): Promise<Response> {
  try {
    const payload = await req.json();
    await fetch(INGEST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}

