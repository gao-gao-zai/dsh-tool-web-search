# DSH Web Search

Persistent Host-side DSH tool that searches Bing or SearXNG and returns only bounded link-and-snippet results.

## Scope

This package exposes `web_search` only. It does not fetch result pages, return webpage content, download images, or depend on `turndown`.

## Install

```sh
dsh plugin --profile web add link:/absolute/path/to/WebSearch
```

Restart the profile after installation. The package patch disables the built-in `tool-web` row so the two tools do not register under the same name. This package contributes only `web_search`; `web_fetch` is intentionally absent.

## Configuration

The plugin uses the `dsh-web-search` settings namespace. The default engine is Bing:

```yaml
engine: bing
maxResults: 10
timeoutMs: 30000
bing:
  market: zh-CN
  setLang: zh-CN
```

For SearXNG:

```yaml
engine: searxng
searxng:
  baseUrl: https://searx.example.com
  apiKeyRef: SEARXNG_API_KEY
  apiKeyHeader: Authorization
  apiKeyPrefix: 'Bearer '
```

The API key is resolved per request through DSH credentials, with an environment-variable fallback when the credentials service is unavailable. It is never placed in the URL or tool output.

## Limits

- Up to 10 results per call.
- Up to 200 Unicode characters per snippet.
- Up to 16K characters in rendered tool output.
- Oversized responses are truncated or rejected before parsing.

See `docs/requirements.md` for the complete requirements and acceptance criteria.
