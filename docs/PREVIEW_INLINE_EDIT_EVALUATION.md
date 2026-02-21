# 预览页直接编辑需求评估

## 需求简述

- 预览网站时，鼠标悬停在**文字**上：文本块高亮边框 + 显示「编辑」按钮，点击可修改文字。
- 鼠标悬停在**图片**上：图片高亮边框 + 显示「替换」按钮，点击可修改图片 URL（及 alt）。

## 结论：**可以实现**

现有架构已具备所需的数据与接口，主要工作是在预览页增加「直接编辑」模式下的 UI 与交互逻辑。

---

## 现有基础

| 能力 | 现状 |
|------|------|
| 预览展示 | 项目页用 iframe 加载 `/api/project/[id]/site/index.html`，同源，父页可访问 `iframe.contentDocument`。 |
| 可编辑块 | `lib/html-blocks.ts` 已定义：`h1–h6, p, img` 为可编辑块，用 `data-block-id` 标识。 |
| 块数据与持久化 | GET `/api/project/[id]/blocks?path=index.html` 会对 HTML 做 `ensureBlockIds` 并写回存储，返回 `{ path, blocks }`。PUT 同路径可传 `blocks: [{ id, content?, alt? }]` 更新并写回 HTML。 |
| 编辑页 | 编辑页已有「侧栏块列表 + 保存」流程，保存后通过 PUT blocks 更新 HTML 并刷新 iframe。 |

因此：**块模型、ID、读写接口都已就绪**，只需在「预览页」上增加悬停高亮、浮动按钮和编辑弹窗，并调用现有 blocks API。

---

## 实现思路

### 1. 入口与数据准备

- **方式 A**：在现有项目预览页（`/project/[id]`）顶部增加「直接编辑」开关；开启后进入「预览 + 直接编辑」模式。
- **方式 B**：新路由如 `/project/[id]/preview-edit`，专门用于「预览 + 直接编辑」。

进入该模式时：

1. 先请求 `GET /api/project/[id]/blocks?path=index.html`（会确保 HTML 中可编辑元素带有 `data-block-id` 并写回）。
2. 再加载 iframe，`src` 仍为 `/api/project/[id]/site/index.html`（此时存储中的 HTML 已带 block id）。

这样 iframe 内的 `h1–h6, p, img` 都会有 `data-block-id`，便于后续绑定事件和更新。

### 2. 悬停高亮与「编辑/替换」按钮

- **时机**：iframe 的 `onLoad` 之后执行。
- **步骤**：
  1. 用 `iframe.contentDocument.querySelectorAll('[data-block-id]')` 拿到所有可编辑元素。
  2. 对每个元素绑定 `mouseenter` / `mouseleave`：
     - **mouseenter**：给该元素加高亮样式（如 `outline` + `box-shadow`），并计算其在**父页面视口**中的位置（用 iframe 内元素的 `getBoundingClientRect()` + iframe 的 `getBoundingClientRect()`），在父页面用 React state 记录「当前悬停的 blockId、块类型、按钮位置」。
     - **mouseleave**：去掉高亮样式，并清空上述 state。
  3. 在**父页面**根据 state 渲染一个浮动按钮：
     - 文本块（heading/paragraph）显示「编辑」；
     - 图片块显示「替换」。
  4. 按钮位置用「当前悬停块的矩形 + 父页坐标」计算，放在块右上角或下方，避免遮挡内容。

这样即可实现「悬停 → 高亮边框 + 编辑/替换按钮」。

### 3. 点击编辑 / 替换后的保存

- **编辑（文本）**：点击「编辑」后，根据当前 blockId 从已有 `blocks` 中取到对应块，打开模态框，用 `textarea` 编辑 `content`，确认后调用：
  - `PUT /api/project/[id]/blocks`，body：`{ path: "index.html", blocks: [{ id: blockId, content: newContent }] }`。
- **替换（图片）**：点击「替换」后，模态框内提供「图片 URL」和「替代文字(alt)」输入，确认后 PUT 同上，传 `{ id, content: newSrc, alt: newAlt }`。

保存成功后二选一：

- **简单做法**：重设 `iframe.src` 或 `iframe.srcdoc`，重新加载页面；
- **更顺滑**：在 iframe 内直接改 DOM（该元素的 `textContent` 或 `src`/`alt`），无需整页刷新。

两者都能实现「点击编辑/替换 → 修改内容并持久化」。

### 4. 与现有编辑页的关系

- 现有「编辑」页（侧栏列表 + 表单）保留不变，适合批量、多块、多文件编辑。
- 「预览页直接编辑」侧重：在所见即所得预览上，点哪改哪，适合小范围、单块修改。
- 两者共用同一套 blocks API 和 `data-block-id`，数据一致。

---

## 技术注意点

1. **同源与 iframe 访问**：预览 iframe 的 src 是本站 API，同源，父页可安全使用 `iframe.contentDocument` 做查询和样式注入；当前 `sandbox="allow-scripts"` 不影响父页对 document 的只读/操作（脚本在 iframe 内跑，父页在父页 document 里挂按钮）。
2. **确保有 data-block-id**：必须在进入「直接编辑」时先调用 GET blocks（会 ensure 并写回），再加载 iframe，否则 iframe 内可能还没有 `data-block-id`。
3. **多页面**：若只做单页，可固定 `path=index.html`；若后续支持多 HTML 文件，可像编辑页一样增加「当前文件」选择，再按 path 加载 blocks 和 iframe。
4. **样式隔离**：高亮样式通过 iframe 的 document 注入（或 class），避免污染站点原有样式；浮动按钮在父页渲染，不进入 iframe 文档。

---

## 建议实现顺序

1. 在项目预览页增加「直接编辑」入口（或新路由）。
2. 进入后先 GET blocks 再加载 iframe，在 onLoad 后绑定 `[data-block-id]` 的 mouseenter/mouseleave，实现悬停高亮 + 父页浮动「编辑/替换」按钮。
3. 实现「编辑」模态框（文本）和「替换」模态框（图片 URL + alt），保存时调用 PUT blocks，成功后刷新 iframe 或局部更新 iframe DOM。
4. 按需支持多 HTML 文件切换（与编辑页一致）。

按上述顺序即可在预览网站时实现「悬停高亮 + 编辑/替换按钮 + 直接修改文字与图片 URL」的完整流程。
