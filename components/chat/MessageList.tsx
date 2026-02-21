"use client";

import { MessageBubble } from "./MessageBubble";

export type MessageItem = { role: "user" | "assistant"; content: string };

type MessageListProps = {
  messages: MessageItem[];
  isLoading?: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      {messages.map((m, i) => (
        <MessageBubble key={i} role={m.role} content={m.content} />
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-200 text-gray-600 rounded-2xl px-4 py-2.5 text-sm">
            AI 正在思考…
          </div>
        </div>
      )}
    </div>
  );
}
