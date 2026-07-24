import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { ServiceError } from "@/services/errors";
import { updateItem, deleteItem } from "@/db/repositories/items";
import { ITEM_STATUSES } from "@/db/schema/items";

const updateItemSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
});

type UpdateItemBody = z.infer<typeof updateItemSchema>;
type ItemParams = { id: string };

export const PATCH = withAuth<UpdateItemBody, ItemParams>(
  { name: "items#update", body: updateItemSchema, limit: "write" },
  async ({ userId, body, params }) => {
    const item = await updateItem(userId, params.id, body);
    if (!item) throw new ServiceError("NOT_FOUND", "Item not found.");
    return { item };
  },
);

export const DELETE = withAuth<undefined, ItemParams>(
  { name: "items#delete", limit: "write" },
  async ({ userId, params }) => {
    const deleted = await deleteItem(userId, params.id);
    if (!deleted) throw new ServiceError("NOT_FOUND", "Item not found.");
    return { ok: true };
  },
);
