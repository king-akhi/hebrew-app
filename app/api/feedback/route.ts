/**
 * POST /api/feedback
 *
 * Saves user feedback to the feedback table.
 *
 * Request body:
 *   { type: "bug" | "product"; message: string; page_url?: string }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { type: string; message: string; page_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!["bug", "product"].includes(body.type)) {
    return NextResponse.json({ error: "type must be 'bug' or 'product'" }, { status: 400 });
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    type: body.type,
    message: body.message.trim().slice(0, 2000),
    page_url: body.page_url ?? null,
  });

  if (error) {
    console.error("[feedback] Insert error:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
