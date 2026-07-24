import type { LanguageModelMiddleware } from "ai";

/**
 * AI SDK middleware that sanitizes tool-related issues before the API call.
 *
 * 1. Strips `suspendedToolRunId` / `resumeData` from tool schemas.
 *    Mastra injects these into agent / workflow tool schemas even when
 *    autoResumeSuspendedTools is disabled. Models frequently generate
 *    malformed JSON for these optional fields, killing the tool call.
 *
 * 2. Fixes missing `input` on replayed tool-call parts.
 *    When malformed JSON slips through, `input` becomes undefined.
 *    The agentic loop replays the assistant message, but Anthropic
 *    rejects without `input`. We patch those to `{}`.
 *
 * Ported verbatim from jobflow's
 * web/lib/mastra/middleware/tool-input-sanitizer.ts.
 */

/**
 * The mutable slice of a function tool's JSON Schema that step 1 rewrites.
 * `required` is typed `string[]` because that is the only shape the filter
 * below acts on — it stays `Array.isArray`-guarded at runtime regardless.
 */
type MutableToolSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

/**
 * A function tool as it reaches this middleware, plus the legacy `parameters`
 * key. The provider spec bundled with `ai` v7 names a function tool's schema
 * `inputSchema`; `parameters` was the pre-v4 spelling this middleware was
 * written against, so it is declared optional here — it is not on the current
 * provider type. See the note at the read site.
 */
type FunctionToolWithLegacySchema = {
  parameters?: MutableToolSchema;
};

/** An assistant tool-call part whose `input` may need backfilling. */
type MutableToolCallPart = {
  input?: unknown;
};

export const toolInputSanitizerMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  transformParams: async ({ params }) => {
    if (params.tools?.length) {
      for (const tool of params.tools) {
        const name: string | undefined = tool.name;
        if (
          tool.type !== "function" ||
          (!name?.startsWith("agent-") && !name?.startsWith("workflow-"))
        ) {
          continue;
        }

        // NOTE: reads `parameters` — the pre-v4 name for a function tool's JSON
        // Schema. Under the provider spec bundled with `ai` v7 the field is
        // `inputSchema`, so this lookup resolves to undefined and the strip
        // below is currently inert. Left as-is deliberately: pointing it at
        // `inputSchema` would start mutating the schemas actually sent to the
        // model, which is a behavior change rather than a typing fix.
        const schema = (tool as FunctionToolWithLegacySchema).parameters;
        if (schema?.properties) {
          delete schema.properties.suspendedToolRunId;
          delete schema.properties.resumeData;
          if (Array.isArray(schema.required)) {
            schema.required = schema.required.filter(
              (r: string) => r !== "suspendedToolRunId" && r !== "resumeData",
            );
          }
        }
      }
    }

    for (const message of params.prompt) {
      if (message.role !== "assistant") continue;
      if (!Array.isArray(message.content)) continue;

      for (const part of message.content) {
        if (part.type !== "tool-call") continue;
        const call = part as MutableToolCallPart;
        if (call.input === undefined) {
          call.input = {};
        }
        if (call.input) {
          const input = call.input as Record<string, unknown>;
          if ("suspendedToolRunId" in input) delete input.suspendedToolRunId;
          if ("resumeData" in input) delete input.resumeData;
        }
      }
    }

    return params;
  },
};
