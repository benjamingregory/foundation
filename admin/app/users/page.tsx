import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/require-admin";
import { getDb } from "@/db/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Users · foundation admin" };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

export default async function UsersPage() {
  // Gate first: nothing below this line runs for a non-operator.
  await requireAdmin();

  const { db, schema } = getDb();
  const rows = await db
    .select({
      userId: schema.userProfiles.userId,
      email: schema.userProfiles.email,
      displayName: schema.userProfiles.displayName,
      createdAt: schema.userProfiles.createdAt,
      plan: schema.userBilling.plan,
    })
    .from(schema.userProfiles)
    .leftJoin(
      schema.userBilling,
      eq(schema.userProfiles.userId, schema.userBilling.userId),
    )
    .orderBy(desc(schema.userProfiles.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "account" : "accounts"} signed up.
        </p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell className="font-medium">{r.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.displayName ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.plan === "pro" ? "default" : "secondary"}>
                    {r.plan ?? "free"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(r.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
