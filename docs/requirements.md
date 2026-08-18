# 网络搜索持久化插件（Web Search Plugin）需求文档

## 1. 概述

本插件为 DeepSeek Harness（DSH）提供两个模型工具，使 Agent 具备联网搜索与网页内容获取能力：

1. **搜索工具（Search）**：将关键词提交给配置的搜索引擎，返回可能存在答案的网页链接及其简介；**不包含页面实际内容**。
2. **网页爬取工具（Fetch / Crawl）**：将指定网页抓取并转换为 Markdown 格式返回；**不解析图像资源**。

插件意图为**持久化插件**：即作为 DSH 的正式扩展（agent preset / host 组成的插件行），随 DSH 一起被加载与维护，而不是本会话中临时的动态 Cordis Plugin。持久化实现归属位置说明见 [§7 持久化归属](#7-持久化归属与交付物)。

## 2. 工具职责划分

### 2.1 搜索工具 `web_search`

| 项 | 说明 |
| --- | --- |
| 输入 | `query`（字符串，必填，搜索关键词）；可选 `limit`（返回结果条数上限）、`language`（语言/市场） |
| 输出 | 结构化结果数组：`{ title, url, snippet }` |
| 约束 | **只返回链接和简介（snippet）**，不抓取、不返回页面正文内容；正文获取由爬取工具负责 |
| 行为 | 可配置使用 **Bing 搜索** 或 **SearXNG**（见 §3） |

> 注意：本插件的搜索工具输出是「链接 + 简介」，与 DSH 内置的不带工具、仅由检索服务提供摘要的搜索不同——本插件将搜索能力**以模型 Tool 的形式**暴露给 Agent。

### 2.2 网页爬取工具 `web_fetch`

| 项 | 说明 |
| --- | --- |
| 输入 | `url`（字符串，必填，目标网页地址）；可选 `maxLength`（返回正文长度上限，防止超长页面溢出上下文） |
| 输出 | `{ url, title, markdown }` |
| 约束 | 将 HTML 转换为 **Markdown（GitHub Flavored 风格）**；**不包含、不下载、不解析任何图像资源**（图片链接在 Markdown 中原样保留或按配置移除均可，但绝不抓取图片二进制） |
| 实现建议 | 使用 [`turndown`](https://www.npmjs.com/package/turndown)（MIT License）作为 HTML→Markdown 转换核心 |

## 3. 搜索引擎配置

插件需支持两种搜索引擎后端，通过配置切换：

### 3.1 Bing 搜索（默认，零配置可选）

参考项目：https://github.com/AusertDream/bing-search-cli（MIT License）

- 原理：直接请求 Bing 公开 HTML 搜索页（`https://www.bing.com/search?q=...`），解析结果 DOM，解码 Bing 跳转链接（`https://www.bing.com/ck/a?...`）还原真实 URL。
- 特点：
  - **无需 API Key**，无需注册；
  - 无内置速率限制（但应内置合理的请求节流 / 重试，避免被封）；
  - 中文查询可切换到 `zh-CN` 市场（`setlang` / `mkt` 参数）。
- 实现要点（借鉴 `bing-search-cli`，**仅借鉴思路与协议解析，不直接复制其代码**，MIT 协议下引用需保留版权声明）：
  1. 请求 `https://www.bing.com/search?q={query}&mkt={market}&setlang={lang}`，带合理的 `User-Agent`；
  2. 用 HTML 解析（如 `parse5` / `cheerio`）定位搜索结果条目（`li.b_algo`）；
  3. 提取 `h2 > a` 的标题与链接，解码 `ck/a` 跳转；提取摘要文本（`p` / `.b_caption`）；
  4. 跨结果去重（按域名 + 标题）。
- 配置项：
  - `engine: "bing"`
  - `bing.market`：市场代码，默认 `zh-CN`（中文）或 `en-US`；
  - `bing.setLang`：界面语言；
  - `bing.userAgent`：自定义 UA（可选）；
  - `bing.proxy`：可选代理（兼容 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量）。

### 3.2 SearXNG（需自建实例 + API）

- 原理：调用自建的 [SearXNG](https://docs.searxng.org/) 实例的 JSON API（`/search?q=...&format=json`），聚合多引擎结果。
- **必须配置**：
  - `searxng.url`：SearXNG 实例地址（如 `https://searx.example.com`）；
  - `searxng.apiKey`：实例配置的 API 密钥（若实例启用了 `limiter` / 认证）。
- 可选：`searxng.engines`（限定引擎）、`searxng.categories`。
- 注意：SearXNG 本身是 AGPL-3.0 协议的开源软件，但**本插件只是其 API 的客户端**，不包含 SearXNG 代码；若用户自建 SearXNG 实例，实例本身遵循其 AGPL-3.0 协议，与本插件的协议无关。

## 4. 爬取工具实现要点

- 使用 `turndown`（MIT）作 HTML→Markdown 核心。`TurndownService` 的 `turndown(html)` 转换页面主体 HTML。
- 前置处理：
  1. 发起请求（遵循 robots 的谨慎原则：可设 UA、限频）；
  2. 根据 `Content-Type` 处理字符集（`utf-8` 为主；必要时按 `meta charset` / `Content-Type` 解码）；
  3. 提取 `<title>`；剥离 `<script>`、`<style>`、`<nav>`、`<footer>`、`<header>` 等噪音节点（可用 `turndown` 的 `remove` 规则或先剪 DOM）；
  4. 相对链接（`href`/`src`）解析为绝对 URL（基于页面 URL）；
- 图像处理：
  - **不下载、不解析任何图像资源**；
  - Markdown 中的图片语法（`![alt](url)`）可保留（保留的是图片 URL 而非图片内容），方便阅读；若版权/带宽考虑，也可提供 `stripImages: true` 配置项将图片全部移除。
- 返回长度控制：超过 `maxLength` 截断（建议同时截掉未闭合的 Markdown 结构）。

## 5. 依赖与开源协议合规

| 项目 | 用途 | 协议 | 合规要求 |
| --- | --- | --- | --- |
| [bing-search-cli](https://github.com/AusertDream/bing-search-cli) | Bing 搜索协议参考（参考设计，非直接依赖） | MIT | 若复制其代码或显著借鉴实现，需在 NOTICE/依赖清单中保留其版权声明（Copyright (c) 2026 AusertDream） |
| [turndown](https://www.npmjs.com/package/turndown) | HTML→Markdown 转换（运行时依赖） | MIT | 在 package.json 声明依赖并保留版权/许可声明 |
| [SearXNG](https://docs.searxng.org/) | 可选搜索后端（仅 API 客户端，非本插件代码） | AGPL-3.0 | 本插件不含其代码；自建实例者自行遵守 AGPL-3.0 |

合规原则：

- 插件自身需要一个开源协议（建议 MIT，与参考项目一致）；
- 运行时依赖 `turndown`（MIT）无传染性，可安心引用；
- 若借鉴 `bing-search-cli` 源码，遵守 MIT 的「保留版权声明」要求：在仓库中放置 `NOTICE` 或 `licenses/THIRD_PARTY_NOTICES` 文件列明来源。

## 6. 其他需求

- **持久化**：作为持久化插件安装到 DSH（见 §7），随 DSH 启动加载；工具存在运行时错误需要有日志与可控降级（如 Bing 被封时提示切换 SearXNG）。
- **错误处理**：搜索失败（网络错误、无结果、被限流）返回结构化错误信息，不抛出异常打断 Agent。
- **配置管理**：引擎选择与各引擎参数通过 DSH 配置（env / yml / 插件 settings）提供；密钥类配置（如 SearXNG API Key）建议走 DSH 凭据体系保存，避免明文入库。
- **Token 意识**：工具输出限制在合理长度内（默认结果 ≤ 10 条、摘要 ≤ 200 字），为 Agent 上下文考虑。

## 7. 持久化归属与交付物

该插件是 DSH 的**持久化扩展**（非会话级动态插件）。持久化归属与交付物：

1. **插件代码**：放入 DSH 插件全家桶仓库（类似 `dsh-ssh`、`dsh-task-board` 的组织方式），经聚合包一键安装；
2. **Agent preset / 工具注册**：插件以 Host 插件行的方式注册两个模型 Tool（`web_search`、`web_fetch`）到 DSH runtime，使 AGENT 可用；
3. **配置**：引擎选择与参数（Bing market / SearXNG URL + API Key）在插件配置中声明；
4. **文档**：README（安装、配置、使用示例、协议合规说明）；
5. **测试**：引擎选择、结果解析、Markdown 转换的单元测试。

## 8. 验收标准

- [ ] `web_search`：输入关键词 → 返回 `[{ title, url, snippet }]`，无正文内容；
- [ ] Bing 与 SearXNG 双后端可配置切换；
- [ ] `web_fetch`：输入 URL → 返回 Markdown 正文，无图像资源被抓取；
- [ ] 非 HTML 内容（PDF、图片、二进制）给出明确错误或降级提示；
- [ ] 包含 MIT 协议声明与第三方依赖（turndown、bing-search-cli）合规说明；
- [ ] 插件可持久化安装并在 DSH 重启后依然可用。