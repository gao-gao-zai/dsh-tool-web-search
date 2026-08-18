# 网络搜索持久化插件需求文档

## 1. 概述

本插件为 DeepSeek Harness（DSH）提供一个模型工具，使 Agent 能够通过配置的搜索引擎发现当前网页信息。

本期实现搜索和网页抓取能力：

1. **搜索工具 `web_search`**：提交关键词，返回可能存在答案的网页标题、链接和简介。
2. **抓取工具 `web_fetch`**：读取指定 HTTP(S) 网页，将 HTML 转换为有界 Markdown 或返回文本内容。
3. 不下载或解析图片资源，不依赖图像识别能力。

插件是 DSH 的持久化扩展，应作为正式 Host 插件随 profile 加载，而不是当前会话中的临时动态 Cordis Plugin。使用前由用户在 DSH 插件/profile 设置中禁用官方 `tool-web`，本插件提供同名替代工具。

## 2. 搜索工具 `web_search`

### 2.1 输入

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `query` | `string` | 必填，搜索关键词，去除首尾空白后不可为空 |
| `limit` | `integer` | 可选，返回结果条数，默认 10，最大 10 |
| `language` | `string` | 可选，语言或市场代码，如 `zh-CN`、`en-US` |

### 2.2 输出

成功结果的结构为：

```json
{
  "results": [
    {
      "title": "网页标题",
      "url": "https://example.com/article",
      "snippet": "搜索引擎提供的网页简介"
    }
  ],
  "truncated": false
}
```

失败结果使用结构化错误：

```json
{
  "results": [],
  "truncated": false,
  "error": {
    "code": "TIMEOUT",
    "message": "search request timed out",
    "retryable": true
  }
}
```

### 2.3 约束

- 只返回标题、URL 和搜索引擎提供的简介；
- 搜索阶段不请求搜索结果网页，不返回网页正文；需要正文时由 Agent 显式调用 `web_fetch`；
- 不返回原始 HTML、原始 JSON、搜索引擎内部字段或调试数据；
- 搜索失败、配置错误、限流、超时和响应格式错误应转换为结构化错误，不抛出未处理异常打断 Agent。

## 3. 搜索引擎配置

插件支持 Bing 和 SearXNG 两种后端，通过配置切换：

```ts
interface WebSearchConfig {
  enabled: boolean
  announceToAgent: boolean
  fetch: boolean
  engine: 'bing' | 'searxng'
  maxResults: number
  timeoutMs: number
  fetchTimeoutMs: number
  maxResponseBytes: number
  fetchMaxOutputChars: number
  bing: {
    market: string
    setLang?: string
    userAgent?: string
  }
  searxng: {
    baseUrl: string
    apiKeyRef?: string
    apiKeyHeader?: string
    apiKeyPrefix?: string
    engines?: string[]
    categories?: string[]
  }
}
```

### 3.1 Bing

参考项目：https://github.com/AusertDream/bing-search-cli（MIT License）。

实现要求：

- 请求 Bing 公开 HTML 搜索页，例如 `https://www.bing.com/search?q=...`；
- 使用 URL 参数传递关键词、市场和界面语言；
- 设置合理的 `User-Agent` 和 `Accept` 请求头；
- 解析搜索结果条目，提取标题、真实目标 URL 和摘要文本；
- 解码 Bing `ck/a` 等跳转链接，无法可靠解码时丢弃结果；
- 按 URL、域名和标题去重；
- 中文查询支持 `zh-CN` 市场，英文查询支持 `en-US` 市场；
- 参考其协议解析思路但不直接复制源码；若复制或改编代码，必须保留 MIT 版权声明。

建议使用受维护的 HTML 解析器解析搜索结果页，不使用正则表达式直接解析完整 HTML。

### 3.2 SearXNG

调用自建 SearXNG 实例的 JSON API：

```text
GET {baseUrl}/search?q={query}&format=json
```

实现要求：

- `baseUrl` 必须是合法的 HTTP(S) 地址；
- 支持附加语言、引擎和分类参数；
- 使用配置的 API 凭据访问实例；API key 只放在请求 Header，不放入 URL；
- 配置只保存 `apiKeyRef` 等凭据引用，实际 key 通过 DSH credentials 服务按调用解析；
- 将 `results[].title`、`results[].url`、`results[].content` 映射为统一的标题、链接和简介；
- 不返回 SearXNG 原始结果中的引擎、分类、评分或其他内部字段；
- 对空 URL、非 HTTP(S) URL、缺失字段和无效 JSON 进行过滤或结构化报错。

SearXNG 本身为 AGPL-3.0 软件，本插件只作为 API 客户端调用，不包含 SearXNG 源码。

## 4. 网页抓取工具 `web_fetch`

输入为单个 HTTP(S) URL，输出保持与官方 DSH web tool 兼容的结构：

```json
{
  "url": "https://example.com/article",
  "statusCode": 200,
  "body": { "kind": "html", "content": "<html>...</html>" },
  "truncated": false
}
```

实现要求：

- 只允许 `http:` 和 `https:` URL；
- 使用有界、可取消的 GET 请求，遵守 `fetchTimeoutMs` 和 `maxResponseBytes`；
- HTML 使用 `turndown` 和 GFM 插件转换为 Markdown；
- 移除 `script`、`style` 和 `noscript` 节点；
- `text/plain`、JSON 和 XML 等文本类型直接返回文本；
- 非文本二进制类型返回结构化 `INVALID_RESPONSE` 错误；
- 最终渲染结果不超过 `fetchMaxOutputChars`，截断时附带明确提示；
- 不执行网页脚本，不下载或解析图片内容，不跟随页面内链接继续爬取；
- 不把完整 HTTP Header 或凭据写入日志和工具输出。


## 5. 返回长度与 Token 限制

限制必须在引擎结果规范化阶段和最终工具渲染阶段执行，不能只依赖提示文本或前端显示：

- 默认返回结果不超过 10 条，用户传入的 `limit` 不得超过 10；
- 每条 `snippet` 不超过 200 个 Unicode 字符；
- `title` 设置独立长度上限，建议不超过 300 个 Unicode 字符；
- URL 设置合理上限，超长或无效 URL 丢弃；
- 最终模型可见工具输出总长度不得超过 16K 字符；
- 超过总长度时丢弃后续结果并设置 `truncated: true`；
- 错误信息也必须经过长度限制；
- 限制逻辑必须有测试，保证异常长搜索结果不会突破硬上限。

## 6. HTTP、超时与错误处理

统一 HTTP 层负责：

- 传递 DSH 工具调用的取消信号；
- 使用 `timeoutMs` 实现合作式超时；
- 限制响应体最大字节数，避免无界读取；
- 只对网络错误、408、429 和 5xx 等可重试情况进行少量退避重试；
- 4xx 配置或鉴权错误不自动重试；
- 请求取消后等待自身资源清理完成；
- 日志只记录后端、状态码、耗时和错误代码，不记录 API key、完整 Header 或完整响应。

错误代码建议包括：

- `INVALID_QUERY`
- `INVALID_CONFIG`
- `MISSING_CREDENTIAL`
- `HTTP_ERROR`
- `AUTHENTICATION_ERROR`
- `RATE_LIMITED`
- `TIMEOUT`
- `RESPONSE_TOO_LARGE`
- `INVALID_RESPONSE`
- `NO_RESULTS`
- `CANCELLED`
- `INTERNAL_ERROR`

## 7. 持久化插件与工具冲突处理

当前 DSH 官方 `@deepseek-ai/dsh-tool-web` 已注册 `web_search` 和 `web_fetch`。用户需要先在 DSH 插件/profile 设置中禁用官方 `tool-web`，再启动本插件；本插件不修改 shipped preset。

新插件包的 `cordis.patch.yml` 应：

1. 插入新插件行和插件内 Skill provider；
2. 不再尝试从 profile bundle 里禁用 shipped preset 的 `tool-web`；
3. 用户禁用官方行后，由本插件提供兼容的 `web_search` 和 `web_fetch`；
4. 独立安装和全家桶安装都能加载。

插件为 Host-only，不声明 Client half。工具注册、system prompt 和设置监听器必须绑定当前 Fiber，在停止、更新和卸载时自动清理。

## 8. 配置与秘密

- 使用 DSH settings namespace 持久化配置；
- `engine` 为 `bing` 时使用 Bing 配置；为 `searxng` 时校验 SearXNG 地址和凭据引用；
- SearXNG API key 不以明文写入普通 settings 文档；
- API key 通过 `apiKeyRef` 指向 credentials 服务中的环境变量或其他凭据源；
- 每次搜索重新解析凭据，使凭据变化无需重启即可生效；
- 凭据缺失时返回 `MISSING_CREDENTIAL`，不发起 SearXNG 请求；
- 错误、日志和工具输出中不得泄露 API key。

## 9. 依赖与许可证合规

| 项目 | 用途 | 协议 | 合规要求 |
| --- | --- | --- | --- |
| `bing-search-cli` | Bing 搜索协议解析参考，非运行时依赖 | MIT | 仅参考思路；若复制或改编代码，保留版权声明 |
| HTML 解析器 | 解析 Bing HTML 搜索结果 | 以实际依赖为准 | 引入前检查协议并记录在依赖清单 |
| SearXNG | 可选搜索后端，仅通过 API 调用 | AGPL-3.0 | 本插件不包含其源码，自建实例方负责遵守其协议 |

| `@deepseek-ai/dsh-tool-web` | `web_fetch` 工具契约与 HTML→Markdown 转换参考 | MIT | 本插件保留兼容实现并保留本声明 |
| `turndown` | HTML 转 Markdown | MIT | 运行时依赖 |
| `@joplin/turndown-plugin-gfm` | GFM 表格和删除线支持 | MIT | 运行时依赖 |

## 10. 测试要求

### 单元测试

- query 和 limit 参数校验；
- Bing URL 参数编码、市场/语言映射和跳转链接解码；
- Bing HTML fixture 解析、摘要清理、空结果和去重；
- SearXNG JSON 映射、缺失字段、空结果和错误响应；
- URL、标题、摘要清理与长度限制；
- 最终输出不超过 16K 字符；
- `web_fetch` URL 校验、HTML/text 类型识别、Turndown 转换和输出截断；
- HTTP 状态码、超时、取消、响应体过大和重试映射；
- API key 只出现在请求 Header，不出现在 URL、日志和输出；
- 配置与凭据变更影响下一次调用。

### 集成测试

- 工具注册、执行和 disposer 清理；
- `enabled: false` 时不注册工具；
- Bing 不依赖 credentials 服务即可运行；
- SearXNG 缺少凭据时返回结构化错误；
- 用户禁用官方 `tool-web` 后，本插件能注册 `web_search` 和 `web_fetch` 且不重复；
- 独立包和聚合包都能通过 profile mount、typecheck、test 和 build。

## 11. 验收标准

- [ ] 用户禁用官方 `tool-web` 后，插件提供 `web_search` 和 `web_fetch`；
- [ ] Bing 后端可用并返回标题、URL、简介；
- [ ] SearXNG 后端可配置并使用凭据引用；
- [ ] `web_fetch` 可读取 HTTP(S) 页面并将 HTML 转为有界 Markdown；
- [ ] 搜索工具不访问搜索结果网页正文，抓取只在显式调用 `web_fetch` 时发生；
- [ ] 默认最多 10 条结果，摘要最多 200 字符，总输出最多 16K 字符；
- [ ] 超时、限流、鉴权失败和无效响应返回结构化错误；
- [ ] API key 不会出现在日志、URL 或工具输出；
- [ ] 包含 MIT License 和第三方依赖协议说明；
- [ ] 插件可持久化安装，并在 DSH 重启后继续可用。