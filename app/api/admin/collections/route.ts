import { NextRequest, NextResponse } from "next/server";
import { getBackendDb } from "@/lib/backend";
import { verifyAdmin } from "@/lib/admin-auth";

interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  user_id: string;
  source_url: string;
  created_at: number;
  updated_at: number;
}

interface ModuleRow {
  id: string;
  collection_id: string;
  filename: string;
  title: string;
  version: string;
  author: string;
  file_size: number;
  is_encrypted: number;
  source_url: string;
}

export async function GET(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const db = await getBackendDb();

  const collections = await db
    .prepare(
      "SELECT id, slug, title, description, icon_url, user_id, source_url, created_at, updated_at FROM collections ORDER BY updated_at DESC"
    )
    .all<CollectionRow>();

  const modules = await db
    .prepare(
      "SELECT id, collection_id, filename, title, version, author, file_size, is_encrypted, source_url FROM modules ORDER BY created_at"
    )
    .all<ModuleRow>();

  const modulesByCollection = new Map<string, ModuleRow[]>();
  for (const m of modules) {
    const list = modulesByCollection.get(m.collection_id) || [];
    list.push(m);
    modulesByCollection.set(m.collection_id, list);
  }

  const result = collections.map((col) => ({
    ...col,
    modules: modulesByCollection.get(col.id) || [],
  }));

  return NextResponse.json({ collections: result });
}

export async function PATCH(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as {
    id?: string;
    title?: string;
    description?: string;
    icon_url?: string;
  } | null;

  const id = body?.id?.trim();
  const title = body?.title?.trim();
  const description = body?.description?.trim() ?? "";
  const iconUrl = body?.icon_url?.trim() ?? "";

  if (!id) {
    return NextResponse.json({ error: "Missing collection id" }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const db = await getBackendDb();
  const existing = await db
    .prepare("SELECT id FROM collections WHERE id = ?")
    .get<{ id: string }>(id);

  if (!existing) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  await db
    .prepare(
      "UPDATE collections SET title = ?, description = ?, icon_url = ?, updated_at = unixepoch() WHERE id = ?"
    )
    .run(title, description, iconUrl, id);

  return NextResponse.json({ ok: true });
}
