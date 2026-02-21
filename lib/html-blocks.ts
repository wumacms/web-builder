import { parse, type HTMLElement } from "node-html-parser";

const EDITABLE_SELECTOR = "h1, h2, h3, h4, h5, h6, p, img";
const BLOCK_ID_ATTR = "data-block-id";

export type BlockType = "heading" | "paragraph" | "image";

export type EditableBlock = {
  id: string;
  type: BlockType;
  content: string;
  alt?: string;
};

function getBlockType(tag: string): BlockType {
  if (tag === "img") return "image";
  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) return "heading";
  return "paragraph";
}

function collectEditableElements(root: HTMLElement): HTMLElement[] {
  return root.querySelectorAll(EDITABLE_SELECTOR);
}

/**
 * 解析 HTML，为可编辑元素注入 data-block-id，并返回区块列表。
 * 会修改传入的 html 字符串对应的 DOM，返回的 html 需写回存储。
 */
export function parseHtmlToBlocks(html: string): { html: string; blocks: EditableBlock[] } {
  const root = parse(html, { comment: false });
  const elements = collectEditableElements(root);
  const blocks: EditableBlock[] = [];
  elements.forEach((el, index) => {
    const id = `block-${index}`;
    el.setAttribute(BLOCK_ID_ATTR, id);
    const tag = el.tagName?.toLowerCase() ?? "";
    const type = getBlockType(tag);
    if (tag === "img") {
      blocks.push({
        id,
        type: "image",
        content: el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? "",
      });
    } else {
      blocks.push({
        id,
        type,
        content: el.textContent?.trim() ?? "",
      });
    }
  });
  return { html: root.toString(), blocks };
}

/**
 * 从已有 data-block-id 的 HTML 中仅提取区块列表（不修改 HTML）。
 */
export function extractBlocksFromHtml(html: string): { blocks: EditableBlock[] } {
  const root = parse(html, { comment: false });
  const elements = collectEditableElements(root);
  const blocks: EditableBlock[] = [];
  elements.forEach((el) => {
    const id = el.getAttribute(BLOCK_ID_ATTR) ?? `block-${blocks.length}`;
    const tag = el.tagName?.toLowerCase() ?? "";
    const type = getBlockType(tag);
    if (tag === "img") {
      blocks.push({
        id,
        type: "image",
        content: el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? "",
      });
    } else {
      blocks.push({
        id,
        type,
        content: el.textContent?.trim() ?? "",
      });
    }
  });
  return { blocks };
}

/**
 * 根据区块 id 在 HTML 中查找并更新内容。
 */
export function applyBlocksToHtml(
  html: string,
  updates: { id: string; content?: string; alt?: string }[]
): string {
  const root = parse(html, { comment: false });
  const elements = collectEditableElements(root);
  const updateMap = new Map(updates.map((u) => [u.id, u]));
  elements.forEach((el) => {
    const id = el.getAttribute(BLOCK_ID_ATTR);
    if (!id) return;
    const u = updateMap.get(id);
    if (!u) return;
    const tag = el.tagName?.toLowerCase();
    if (tag === "img") {
      if (u.content !== undefined) el.setAttribute("src", u.content);
      if (u.alt !== undefined) el.setAttribute("alt", u.alt);
    } else {
      if (u.content !== undefined) el.textContent = u.content;
    }
  });
  return root.toString();
}

/**
 * 确保 HTML 中可编辑元素都有 data-block-id，若无则注入并返回新 HTML。
 */
export function ensureBlockIds(html: string): { html: string; blocks: EditableBlock[] } {
  const root = parse(html, { comment: false });
  const elements = collectEditableElements(root);
  const blocks: EditableBlock[] = [];
  let nextIndex = 0;
  elements.forEach((el) => {
    let id = el.getAttribute(BLOCK_ID_ATTR);
    if (!id) {
      id = `block-${nextIndex}`;
      el.setAttribute(BLOCK_ID_ATTR, id);
      nextIndex++;
    }
    const tag = el.tagName?.toLowerCase() ?? "";
    const type = getBlockType(tag);
    if (tag === "img") {
      blocks.push({
        id,
        type: "image",
        content: el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? "",
      });
    } else {
      blocks.push({
        id,
        type,
        content: el.textContent?.trim() ?? "",
      });
    }
  });
  return { html: root.toString(), blocks };
}
