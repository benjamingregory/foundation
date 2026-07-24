import { ChatView } from "@/components/chat/chat-view";

/**
 * Chat page — exercises the Mastra slice end to end: `assistant` agent,
 * `list_items` scoped tool, and `POST /api/chat` streaming route. Auth is
 * handled by the (main) layout's `requireUser()`; the API route re-derives
 * the trusted userId itself rather than trusting anything from the client.
 */
export default function ChatPage() {
  return <ChatView />;
}
