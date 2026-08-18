---
name: web-search-operations
description: Use when deciding how to operate the web_search_configured tool, interpret its bounded results, configure search limits, or configure the Bing and SearXNG backends for this DSH plugin.
---

# Web Search Operations

Use this skill together with the `web_search_configured` tool. The tool description defines the callable arguments; this skill defines the operational rules and persistent configuration that do not fit into the tool schema.

## What The Tool Returns

`web_search_configured` returns only a bounded list of:

- `title`: the search result title;
- `url`: the source URL;
- `snippet`: the search engine's short description.

It does **not** open result pages, return page正文, download images, or verify claims from the linked page. Treat a snippet as a lead, not as the complete source content. Do not invent details that are absent from the returned snippet.

The current plugin intentionally provides no `web_fetch` tool. When a snippet is insufficient, state that the available search result does not contain enough evidence and ask for a different query or a separately installed page-reading capability.

## Hard Output Limits

These limits are enforced by the plugin and cannot be raised through a tool call:

- Maximum 10 results per call;
- Maximum 200 Unicode characters per `snippet`;
- Maximum 16,000 characters in the rendered tool result;
- Oversized or invalid result URLs may be dropped;
- `truncated: true` means later results were omitted by a result-count or output-size limit.

Use `limit` between 1 and 10. For broad research, run several focused queries rather than trying to request an unbounded result set. Prefer precise terms, dates, product names, or site filters to improve the signal within the fixed limit.

## Result-Use Procedure

1. Start with one focused query and select the most relevant URLs from the returned titles and snippets.
2. Treat different domains as independent sources; do not count duplicate pages as separate evidence.
3. Cite the returned URLs in the final answer when using their claims.
4. If `truncated` is true, refine the query before drawing a conclusion that depends on omitted results.
5. If the result list is empty, distinguish “no results” from a reported `error` object. Do not silently treat a timeout or authentication failure as evidence that no information exists.

## Persistent Configuration

Engine and limit settings are plugin settings, not `web_search_configured` arguments. The settings namespace is `dsh-web-search`.

### Bing (default)

Bing does not require an API key in this plugin. A typical configuration is:

```yaml
engine: bing
maxResults: 10
timeoutMs: 30000
maxResponseBytes: 2000000
bing:
  market: zh-CN
  setLang: zh-CN
```

Use `en-US` for English-oriented results when appropriate. `maxResults` must be between 1 and 10. `timeoutMs` and `maxResponseBytes` must be positive integers.

### SearXNG

SearXNG requires a reachable instance and an API credential configured by the operator. Example:

```yaml
engine: searxng
maxResults: 10
searxng:
  baseUrl: https://searx.example.com
  apiKeyRef: SEARXNG_API_KEY
  apiKeyHeader: Authorization
  apiKeyPrefix: 'Bearer '
  # Optional:
  # engines: [google, bing]
  # categories: [general]
```

The instance must expose a JSON search endpoint at:

```text
{baseUrl}/search?q=<query>&format=json
```

`apiKeyRef` is a credential reference, normally an environment-style name such as `SEARXNG_API_KEY`; it is not the secret value itself. The plugin resolves the credential for each request. Never put the raw API key in:

- `web_search_configured` arguments;
- the `baseUrl` or query string;
- a committed YAML file;
- a prompt, response, or log message.

The default authentication header is `Authorization: Bearer <key>`. If the SearXNG gateway uses another convention, set `apiKeyHeader` and `apiKeyPrefix` in settings. For example, an `X-API-Key` gateway can use:

```yaml
searxng:
  apiKeyRef: SEARXNG_API_KEY
  apiKeyHeader: X-API-Key
  apiKeyPrefix: ''
```

A missing credential produces a structured `MISSING_CREDENTIAL` error. Do not retry it as a search query; the operator must configure the credential or switch the engine back to Bing.

## Errors And Recovery

Common structured errors include:

- `INVALID_QUERY`: provide a non-empty query;
- `INVALID_CONFIG`: ask the operator to correct the plugin settings;
- `MISSING_CREDENTIAL`: configure the SearXNG credential reference and its value;
- `AUTHENTICATION_ERROR`: verify the SearXNG gateway header and key;
- `RATE_LIMITED`: wait, narrow the query, or use another configured backend;
- `TIMEOUT`: retry once with a more focused query;
- `RESPONSE_TOO_LARGE`: narrow the query or reduce the upstream response;
- `INVALID_RESPONSE`: verify that the SearXNG endpoint returns JSON or that the search engine page is reachable.

Do not expose secrets while explaining an error. Report the error code and the safe part of the message only.

## Configuration Boundary

The Agent can select query, `limit`, and `language` within the tool schema. It cannot change the backend, increase output limits, or write credentials through `web_search_configured`. Backend changes and credential updates belong to the DSH settings/configuration surface and take effect on subsequent calls.
