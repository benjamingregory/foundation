import "server-only";
import { createTool } from "@mastra/core/tools";
import type { z } from "zod";

/**
 * Wrap @mastra/core's createTool to inject `userId` from RequestContext into
 * each tool's execute() call. Tools never accept `userId` as a model-supplied
 * argument — it's always pulled from the trusted request context, eliminating
 * confused-deputy attacks via prompt injection.
 *
 * Ported from jobflow's createCareerOpsTool (renamed createScopedTool; the
 * `batchJobId` extra was dropped — nothing in this skeleton needs it).
 */
export type ScopedToolContext = {
  userId: string;
};

/**
 * The exact `execute` signature `createTool` expects for a given input/output
 * schema pair, recovered from its own declaration.
 *
 * Mastra resolves schemas through its internal `InferSchema<S>` conditional
 * type. For a concrete zod schema that is identical to `z.infer<S>`, but while
 * `I`/`O` are still unresolved type parameters TS cannot reduce the conditional
 * and so cannot prove the two equal. Deriving the signature from `createTool`
 * itself sidesteps that: `inputData` lands correctly typed, and the one
 * unprovable step — our `z.infer<O>` result satisfying Mastra's
 * `InferSchema<O>` — is confined to a single assertion below.
 */
type ToolExecute<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = NonNullable<
  Parameters<typeof createTool<string, I, O>>[0]["execute"]
>;
type ToolExecuteResult<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
> = Awaited<ReturnType<ToolExecute<I, O>>>;

export function createScopedTool<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
>(opts: {
  id: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  execute: (input: z.infer<I>, ctx: ScopedToolContext) => Promise<z.infer<O>>;
}) {
  const execute: ToolExecute<I, O> = async (inputData, context) => {
    const userId = context?.requestContext?.get?.("userId") as
      | string
      | undefined;
    if (!userId) {
      throw new Error(
        `tool ${opts.id}: userId missing from RequestContext (auth misconfigured)`,
      );
    }
    const output = await opts.execute(inputData as z.infer<I>, { userId });
    // `z.infer<O>` and Mastra's `InferSchema<O>` are the same type for any zod
    // schema; TS just can't prove it while `O` is generic. See above.
    return output as ToolExecuteResult<I, O>;
  };

  return createTool({
    id: opts.id,
    description: opts.description,
    inputSchema: opts.inputSchema,
    outputSchema: opts.outputSchema,
    execute,
  });
}
