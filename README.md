# DSH Web Search

Persistent Host-side DSH tools that search Bing or SearXNG and fetch specific HTTP(S) pages with bounded output.

## Scope

This package exposes `web_search` and `web_fetch`. It fetches specific HTTP(S) result pages and converts HTML to bounded Markdown with `turndown`; it does not download or interpret images.

## Install

### Prerequisites

- DSH with the `web` profile
- Node.js 22 or newer
- A writable DSH profile directory

### Install from GitHub

Install the public repository into the `web` profile:

```powershell
dsh plugin --profile web add github:gao-gao-zai/dsh-tool-web-search
```

The equivalent Git URL form is:

```powershell
dsh plugin --profile web add https://github.com/gao-gao-zai/dsh-tool-web-search.git
```

### Install a local checkout

Use a `link:` dependency while developing or testing local changes:

```powershell
dsh plugin --profile web add link:E:\DeepSeekHarness\WebSearch
```

Use an absolute path on other machines. The package includes the prebuilt `lib/` bundle, so a link installation does not require a separate TypeScript build step.

### Disable the official web tools

This package intentionally uses the same model-facing names as the official DSH web tools: `web_search` and `web_fetch`. Disable the shipped `tool-web` row before creating a session with this replacement.

Do not edit the shipped preset under the DSH installation directory. Instead, duplicate the active preset into the user preset directory and change only the copied row:

```yaml
- id: tool-web
  name: '@deepseek-ai/dsh-tool-web'
  disabled: true
```

Select that user-owned preset as the profile default. The exact DSH UI label may be `Agent Presets`, `Profiles`, or `Plugins` depending on the installed web UI version. The important result is that the effective preset contains `disabled: true` for `tool-web`.

The package's `cordis.patch.yml` installs the replacement plugin and its bundled Agent Skill, but does not modify a shipped preset after the preset layer is mounted.

### Restart and verify

Restart the profile after installation and create a **new Agent session**. Existing sessions keep the preset composition they were created with.

```powershell
# Stop the existing dsh web process with Ctrl+C, then run:
dsh web
```

The new session should expose these two tools:

```text
web_search
web_fetch
```

`web_search` should accept `query`, `limit`, and `language`. `web_fetch` should accept one HTTP(S) `url`. A quick fetch smoke test is:

```text
web_fetch({"url":"https://example.com/"})
```

The result should contain a `Fetched https://example.com/ (HTTP 200)` heading and Markdown body content.

## Configure In DSH Web UI

The plugin registers the DSH settings namespace `dsh-web-search` and ships a browser settings card. In the current Web UI bundle, open **Settings → Web UI Plugins → 网页搜索与抓取**. In the official DSH settings surface, the same card is also available under **Settings → Plugins → Plugin configuration**.

No custom frontend page or hand-written YAML is required. After changing the package or its client bundle, restart the **DSH backend process** that owns `http://127.0.0.1:3080`, then refresh the browser page. A browser-only refresh is insufficient because the backend generates `window.__DSH_BOOT__` and serves `/plugins/<package>/client.js` at process startup.

To verify that the new Client half was loaded, this URL must return HTTP 200 after the restart:

```text
http://127.0.0.1:3080/plugins/@gao-gao-zai/dsh-tool-web-search/client.js
```

If it returns HTTP 404, the running backend is still using an old profile boot or a different `DSH_HOME`; the settings card cannot appear until that backend is restarted with the profile containing this package.

The card edits:

- `enabled`: enable or disable both replacement tools;
- `announceToAgent`: enable or disable the operational system-prompt guidance;
- `fetch`: enable or disable `web_fetch`;
- `engine`: choose `bing` or `searxng`;
- `maxResults`: integer from 1 to 10;
- `timeoutMs`: positive search timeout in milliseconds;
- `fetchTimeoutMs`: positive fetch timeout in milliseconds;
- `maxResponseBytes`: positive network response byte cap;
- `fetchMaxOutputChars`: positive rendered fetch output cap;
- `bing`: market, language, and optional User-Agent;
- `searxng`: base URL, credential reference, authentication header/prefix, engines, and categories.

Invalid values are rejected by the DSH settings validator before they are persisted. SearXNG secrets themselves belong in the DSH credentials UI; only `apiKeyRef` is stored in this settings namespace.

## Configuration

The plugin uses the `dsh-web-search` settings namespace. The default engine is Bing:

```yaml
engine: bing
maxResults: 10
timeoutMs: 30000
fetch: true
fetchTimeoutMs: 30000
maxResponseBytes: 2000000
fetchMaxOutputChars: 200000
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

- Search: up to 10 results per call.
- Search: up to 200 Unicode characters per snippet.
- Search: up to 16K characters in rendered tool output.
- Fetch: up to 200K characters in rendered Markdown/text output.
- Both tools: oversized network responses are rejected before unbounded parsing.

See `docs/requirements.md` for the complete requirements and acceptance criteria.

## License

This project is licensed under the MIT License. See `LICENSE` for the full text, `NOTICE` for third-party references, and `THIRD_PARTY_LICENSES.md` for preserved third-party copyright and license notices.

## Agent Skill

The package also bundles `skills/web-search-operations/SKILL.md`. Its profile patch adds a private Skill filesystem provider for that directory, so the Agent receives operational guidance about result limits, Bing/SearXNG configuration, credential references, and error handling without replacing project or user Skill roots.
