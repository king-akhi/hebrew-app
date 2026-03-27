/**
 * POST /api/correct
 *
 * Corrects a student's Hebrew answer using Claude Sonnet.
 *
 * Request body:
 *   { exercise_text: string; student_answer: string; session_id?: string }
 *
 * Response: CorrectionResult (see lib/prompts/correction.ts)
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { CORRECTION_SYSTEM_PROMPT, type CorrectionResult } from "@/lib/prompts/correction";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { exercise_text: string; student_answer: string; expected_hebrew?: string | null; session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.exercise_text?.trim() || !body.student_answer?.trim()) {
    return NextResponse.json({ error: "exercise_text and student_answer required" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: CORRECTION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Exercise: ${body.exercise_text}${body.expected_hebrew ? `\nExpected Hebrew word (from learner's card — use this exact word, do not substitute synonyms): ${body.expected_hebrew}` : ""}\n\nStudent answer: ${body.student_answer}`,
        },
      ],
    });

    const raw = message.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    const result: CorrectionResult = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Log to DB
    await supabase.from("correction_logs").insert({
      user_id: user.id,
      session_id: body.session_id ?? null,
      exercise_text: body.exercise_text,
      student_answer: body.student_answer,
      correction_json: result,
      model_used: "claude-haiku-4-5-20251001",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[correct] Error:", err);
    return NextResponse.json({ error: "Correction failed" }, { status: 500 });
  }
}
