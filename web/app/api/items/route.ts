import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { listItems, createItem } from "@/db/repositories/items";

export const GET = withAuth({ name: "items#list", limit: "default" }, async ({ userId }) => {
  const items = await listItems(userId);
  return { items };
});

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).optional(),
});

export const POST = withAuth(
  { name: "items#create", body: createItemSchema, limit: "write" },
  async ({ userId, body }) => {
    const item = await createItem(userId, body);
    return NextResponse.json({ item }, { status: 201 });
  },
);
