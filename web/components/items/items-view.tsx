"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { apiJson } from "@/lib/data/api-fetch";
import { queryKeys } from "@/lib/query/keys";
import { duration, ease } from "@/lib/motion";
import { ItemRow } from "@/components/items/item-row";
import type { Item, ItemStatus } from "@/db/schema/items";

const TITLE_MAX = 200;
const NOTES_MAX = 4000;

export function ItemsView() {
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.items.list(),
    queryFn: () => apiJson<{ items: Item[] }>("/api/items"),
  });
  const items = data?.items ?? [];

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.items.list() });
  }

  const createMutation = useMutation({
    mutationFn: (input: { title: string; notes?: string }) =>
      apiJson<{ item: Item }>("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setTitle("");
      setNotes("");
      void invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) =>
      apiJson<{ item: Item }>(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson<{ ok: true }>(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    createMutation.mutate({
      title: trimmedTitle,
      notes: notes.trim() || undefined,
    });
  }

  const isRowPending = (id: string) =>
    (toggleMutation.isPending && toggleMutation.variables?.id === id) ||
    (deleteMutation.isPending && deleteMutation.variables === id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Items</h1>
        <p className="text-sm text-muted-foreground">
          A small tracked list — the one user-scoped resource this skeleton
          exercises end to end.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add an item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="item-title">Title</Label>
              <Input
                id="item-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="What needs doing?"
                maxLength={TITLE_MAX}
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                placeholder="Optional notes"
                rows={2}
                maxLength={NOTES_MAX}
                disabled={createMutation.isPending}
              />
            </div>
            {/* Button already carries its own CSS press feedback (see
                components/ui/button.tsx) — no extra motion.div wrapper here,
                since stacking a second whileTap scale on top of it would
                visually compound into a deeper, janky press. The explicit
                motion/react press feedback for this feature lives on the
                item-row label tap target, which has no built-in animation of
                its own. */}
            <Button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
            >
              <Plus />
              {createMutation.isPending ? "Adding…" : "Add item"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No items yet"
          description="Add your first item above to see it show up here."
        />
      ) : (
        <motion.ul
          layout={!prefersReducedMotion}
          className="space-y-2"
          transition={{ duration: duration.fast, ease: ease.out }}
        >
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                pending={isRowPending(item.id)}
                onToggle={() =>
                  toggleMutation.mutate({
                    id: item.id,
                    status: item.status === "done" ? "open" : "done",
                  })
                }
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
