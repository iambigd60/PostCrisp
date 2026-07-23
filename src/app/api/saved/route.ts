import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_content')
    .select('*')
    .eq('user_id', user.id)  // defense-in-depth: don't rely on RLS alone (LOW-3)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to the frontend interface
  const items = data.map((row) => ({
    id: row.id,
    type: row.type,
    content: row.content,
    platform: row.platform || "general",
    createdAt: row.created_at,
  }));

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, content, platform, topic } = body;

    if (!type || !content) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('saved_content')
      .insert({
        user_id: user.id,
        type,
        content,
        platform: platform || "general",
        topic,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const item = {
      id: data.id,
      type: data.type,
      content: data.content,
      platform: data.platform || "general",
      createdAt: data.created_at,
    };

    return NextResponse.json({ item, message: "Content saved successfully!" });
  } catch {
    return NextResponse.json({ error: "Failed to save content." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing item ID." }, { status: 400 });
  }

  const { error } = await supabase
    .from('saved_content')
    .delete()
    .match({ id, user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Item deleted successfully." });
}
