/**
 * GET  /api/settings  — returns the current user's settings
 * PATCH /api/settings — updates one or more settings fields
 *
 * Editable fields:
 *   display_name, level, daily_card_limit,
 *   srs_again_minutes, srs_hard_hours, srs_good_days, srs_easy_days
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED_FIELDS = new Set([
  "display_name",
  "level",
  "daily_card_limit",
  "srs_again_minutes",
  "srs_hard_hours",
  "srs_good_days",
  "srs_easy_days",
  "known_tenses",
]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("display_name, level, daily_card_limit, srs_again_minutes, srs_hard_hours, srs_good_days, srs_easy_days, known_tenses")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow whitelisted fields
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", user.id);

  if (error) {
    console.error("[settings] Update error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
