"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList, type MessageItem } from "@/components/chat/MessageList";
import { ResultCard } from "@/components/preview/ResultCard";

type ChatResponse = {
  projectId?: string;
  messageId?: string | null;
  status?: string;
  previewPath?: string;
  error?: string;
};

export default function Home() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedProjectId, setCompletedProjectId] = useState<string | null>(null);

  const handleSend = useCallback(async (message: string) => {
    setError(null);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          ...(projectId ? { projectId } : {}),
        }),
      });
      const data: ChatResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "请求失败");
        setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，生成失败：" + (data.error ?? "未知错误") }]);
        return;
      }
      if (data.projectId) {
        setProjectId(data.projectId);
        if (data.status === "completed") {
          setCompletedProjectId(data.projectId);
          setProjectId(null);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "站点已生成。如需修改内容请使用下方「编辑内容」进行可视化编辑；如需新建网站请继续输入描述。" },
          ]);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络错误";
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: "请求失败：" + msg }]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <main className="min-h-screen flex flex-col items-center py-8 px-4">
      <header className="mb-8 text-center">
        <div className="flex justify-end mb-2">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">项目列表</Link>
        </div>
        <h1 className="text-2xl font-semibold text-gray-800">AI 建站平台</h1>
        <p className="text-gray-500 mt-1 text-sm">描述你想做的网站，AI 帮你生成 Tailwind 静态站</p>
      </header>
      <div className="flex flex-col items-center gap-6 w-full">
        <ChatInput onSend={handleSend} disabled={loading} />
        {error && (
          <p className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}
        {messages.length > 0 && (
          <MessageList messages={messages} isLoading={loading} />
        )}
        {completedProjectId && (
          <ResultCard projectId={completedProjectId} />
        )}
      </div>
    </main>
  );
}
