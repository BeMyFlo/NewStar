// src/app/api/coaching-notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getServerAuth();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role === "creator") {
      return NextResponse.json({ error: "Forbidden: Creators cannot write coaching notes" }, { status: 403 });
    }

    const { creatorId, notes } = await req.json();

    if (!creatorId || !notes || !notes.trim()) {
      return NextResponse.json({ error: "Missing required fields (creatorId, notes)" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // If manager, verify assignment
    if (role === "manager" || role === "manager_lead") {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("creator_manager_assignments")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("manager_id", user.id)
        .is("ended_at", null)
        .maybeSingle();

      if (assignmentError) {
        return NextResponse.json({ error: `Assignment check failed: ${assignmentError.message}` }, { status: 500 });
      }

      // If no assignment and not an admin/owner, block unless it's a manager lead who might have overall view
      if (!assignment && role === "manager") {
        return NextResponse.json({ error: "Forbidden: You are not assigned to this creator" }, { status: 403 });
      }
    }

    // Insert coaching note
    const { data: note, error: noteError } = await supabaseAdmin
      .from("coaching_notes")
      .insert({
        creator_id: creatorId,
        manager_id: user.id,
        notes: notes.trim(),
      })
      .select()
      .single();

    if (noteError) {
      return NextResponse.json({ error: `Failed to create coaching note: ${noteError.message}` }, { status: 500 });
    }

    // Log audit log
    await supabaseAdmin.from("audit_log").insert({
      user_id: user.id,
      action: "CREATE_COACHING_NOTE",
      details: { note_id: note.id, creator_id: creatorId }
    });

    return NextResponse.json({ success: true, note });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user, role, error: authError } = await getServerAuth();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Creators can't read internal coaching notes
    if (role === "creator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: notes, error: notesError } = await supabaseAdmin
      .from("coaching_notes")
      .select(`
        *,
        profiles!coaching_notes_manager_id_fkey (
          display_name
        )
      `)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notes });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
