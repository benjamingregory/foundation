import { withAuth } from "@/lib/api/with-auth";
import { listRunsForUser } from "@/db/repositories/inngestRuns";

export const GET = withAuth(
  { name: "jobs#list", limit: "default" },
  async ({ userId }) => {
    const runs = await listRunsForUser(userId);
    return { runs };
  },
);
