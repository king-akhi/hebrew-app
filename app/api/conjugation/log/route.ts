/**
 * POST /api/conjugation/log
 *
 * Logs a conjugation practice answer for streak/heatmap tracking.
 * Body: { verb_hebrew: string, correct: boolean }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { verb_hebrew?: string; correct?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { verb_hebrew, correct } = body;
  if (!verb_hebrew) return NextResponse.json({ error: "verb_hebrew required" }, { status: 400 });

  const { error } = await supabase.from("conjugation_logs").insert({
    user_id: user.id,
    verb_hebrew,
    score_correct: correct ? 1 : 0,
    score_total: 1,
  });

  if (error) {
    console.error("[conjugation/log]", error);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
