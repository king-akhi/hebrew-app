/**
 * PATCH /api/cards/[id]  — update editable fields
 * DELETE /api/cards/[id] — delete card + associated fsrs_state rows
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TEXT_FIELDS = new Set(["transliteration", "english", "grammar_notes", "user_notes", "example_sentence_he", "example_sentence_en"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify the card belongs to this user's org
  const { data: card, error: fetchError } = await supabase
    .from("cards")
    .select("id, deck_id, decks!inner(organization_id)")
    .eq("id", id)
    .single();

  if (fetchError || !card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  // Text fields
  for (const field of TEXT_FIELDS) {
    if (field in body) {
      const val = body[field];
      patch[field] = typeof val === "string" ? val.trim() || null : null;
    }
  }

  // Tags
  if ("tags" in body) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }
    patch.tags = [...new Set(
      (body.tags as unknown[])
        .map((t) => String(t).trim().toLowerCase().slice(0, 30))
        .filter(Boolean)
    )].slice(0, 20);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update(patch)
    .eq("id", id);

  if (updateError) {
    console.error("[cards/patch] Update error:", updateError);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }

  return NextResponse.json(patch);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership before deleting
  const { data: card, error: fetchError } = await supabase
    .from("cards")
    .select("id, deck_id, decks!inner(organization_id)")
    .eq("id", id)
    .single();

  if (fetchError || !card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("cards")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[cards/delete] Error:", deleteError);
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
