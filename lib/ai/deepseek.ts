import OpenAI from "openai";

const SYSTEM_PROMPT = `你是一个静态网站生成器，只使用 Tailwind CSS。你必须输出一个 JSON 对象，且仅输出该 JSON，不要输出 markdown 代码块或其它说明。

要求：
1. 所有样式仅通过 Tailwind CSS 工具类实现（如 flex, grid, text-lg, bg-blue-500, rounded-lg, md:flex-row 等），不要输出大段自定义 CSS。
2. 每个 HTML 页面必须在 <head> 中包含：<script src="https://cdn.tailwindcss.com"></script>
3. JSON 格式必须为：{"pages":[{"path":"index.html","content":"完整 HTML 字符串"},...],"assets":[{"path":"js/main.js","content":"..."}]}
4. path 使用相对路径，如 index.html、about.html、js/main.js。至少包含 index.html。
5. HTML 必须是完整可运行的，含 <!DOCTYPE html>、<html>、<head>、<body>。`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const openai = new OpenAI({ apiKey, baseURL });
  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    temperature: 0.3,
    max_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from DeepSeek");
  return content;
}
