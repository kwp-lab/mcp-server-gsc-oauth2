# mcp-server-gsc-oauth2

Enhanced MCP server for Google Search Console with **dual authentication support**. This is a fork of [mcp-server-gsc-pro](https://github.com/ricardo-nth/mcp-server-gsc) that adds:

- 🔐 **OAuth2 User Authorization** — Access Search Console with user credentials, no service account setup needed
- 🔄 **Automatic Token Refresh** — OAuth2 tokens are automatically refreshed when expired
- 🎯 **Flexible Credential Loading** — Support for environment variables (JSON strings) or file paths for both auth modes
- ↔️ **Backward Compatible** — All existing Service Account configurations continue to work

The server provides 31 tools spanning raw API access, computed intelligence, and adjacent Google APIs — designed for AI agents that do SEO work.

## Who this is for

Teams and individuals using AI coding agents (Claude Code, Cursor, etc.) for SEO. If you manage websites and want your AI assistant to query Search Console data, diagnose indexing issues, track performance trends, and surface actionable insights — without writing API code — this is the tool.

## What it does

This server wraps the full Google Search Console API surface into MCP tools, with added computed intelligence that combines multiple API calls into higher-level insights. It also integrates PageSpeed Insights, Google Indexing API, Chrome UX Report (CrUX), and mobile-friendly testing.

**Dual Authentication** — Choose between Service Account (server-to-server) or OAuth2 (user authorization) modes. OAuth2 tokens auto-refresh, and credentials can be loaded from environment variables or files.

**Raw API access** — search analytics with filtering, URL inspection, sitemaps CRUD, sites CRUD.

**Computed intelligence** — period comparison with delta tracking, content decay detection, keyword cannibalization analysis, CTR benchmarking, keyword diff, batch inspection, SERP feature tracking, automated drop alerts, and page-level health dashboards that pull from 4 APIs in a single call.

**Reliability** — auto-retry with exponential backoff, structured error types with fix instructions, input validation on all fields, auto-pagination for large result sets, and partial-failure tolerance on multi-API tools.

## What it doesn't do

- No web scraping or crawling — this is API data only
- No content generation or optimization suggestions — it surfaces data, the AI agent interprets it
- No Google Ads or GA4 integration
- Indexing API notifications are officially limited to JobPosting/BroadcastEvent schema types

## 🔐 Authentication Modes

This MCP server supports two authentication modes, controlled by the `GOOGLE_AUTH_MODE` environment variable:

| Mode | Value | Description |
|------|-------|-------------|
| **Service Account** | `service_account` (default) | Use a GCP service account JSON key for server-to-server authentication |
| **OAuth2** | `oauth2` | Use user-authorized OAuth2 tokens to access Search Console on behalf of a user |

---

## Setup

### Mode 1: Service Account (Default)

Use this mode for server-to-server authentication without user interaction.

#### Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Search Console API** and **Indexing API** under [APIs & Services > Library](https://console.cloud.google.com/apis/library)
4. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials) and create a **Service Account**
5. Create a key for the service account (JSON format) and download it
6. In [Google Search Console](https://search.google.com/search-console/), add the service account email as a user for each property you want to access

#### Environment Variables

```env
# Optional: defaults to 'service_account'
GOOGLE_AUTH_MODE=service_account

# Priority 1: Direct JSON string
GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Priority 2: Path to JSON file (alternative)
GOOGLE_CREDENTIALS_PATH=/path/to/service-account.json

# Priority 3: Fallback for backward compatibility
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

> **Note**: The server checks environment variables in the priority order listed above. Set only one.

#### Configuration Example

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "gsc": {
      "command": "npx",
      "args": ["-y", "mcp-server-gsc-pro"],
      "env": {
        "GOOGLE_AUTH_MODE": "service_account",
        "GOOGLE_CREDENTIALS_PATH": "/path/to/service-account.json"
      }
    }
  }
}
```

Or using the older variable name (still supported):

```json
{
  "mcpServers": {
    "gsc": {
      "command": "npx",
      "args": ["-y", "mcp-server-gsc-pro"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account-key.json"
      }
    }
  }
}
```

---

### Mode 2: OAuth2 User Authorization

Use this mode to access Search Console data on behalf of a user with their own permissions.

#### Advantages

- ✅ Access the user's own Search Console properties without service account setup
- ✅ No need to add service accounts to Search Console property permissions
- ✅ Works with the user's existing Google account permissions

> ⚠️ **Important**: This MCP server does **NOT** include the OAuth2 authorization flow itself. You need to implement the OAuth2 consent flow separately to obtain the tokens.

#### 1. Implement OAuth2 Authorization Flow (Your Responsibility)

You need to implement the OAuth2 authorization flow using libraries like [`googleapis`](https://www.npmjs.com/package/googleapis).

Required OAuth2 scopes:
```
https://www.googleapis.com/auth/webmasters
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/indexing
```

Example OAuth2 flow (simplified):
```javascript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate auth URL and redirect user
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',  // Important: to get refresh_token
  scope: [
    'https://www.googleapis.com/auth/webmasters',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/indexing'
  ]
});

// After user consent, exchange code for tokens
const { tokens } = await oauth2Client.getToken(code);

// Save tokens to tokens.json
fs.writeFileSync('tokens.json', JSON.stringify(tokens, null, 2));
```

#### 2. tokens.json Format

After completing the OAuth2 flow, save the tokens in a `tokens.json` file:

```json
{
  "access_token": "ya29.a0AWY7CknXXX...",
  "refresh_token": "1//0eXXX...",
  "scope": "https://www.googleapis.com/auth/webmasters ...",
  "token_type": "Bearer",
  "expiry_date": 1234567890000
}
```

| Field | Description | Required |
|-------|-------------|----------|
| `access_token` | The OAuth2 access token | ✅ Yes |
| `refresh_token` | The refresh token (for auto-renewal) | ⚠️ Recommended |
| `expiry_date` | Token expiration timestamp in milliseconds | Optional |
| `scope` | Authorized scopes | Optional |
| `token_type` | Token type (usually "Bearer") | Optional |

> **Security Note**: Keep `tokens.json` secure and never commit it to version control. Add it to `.gitignore`.

#### 3. Environment Variables

```env
# Required: Set authentication mode to oauth2
GOOGLE_AUTH_MODE=oauth2

# Recommended: OAuth2 client credentials (required for automatic token refresh)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Token source (choose one):
# Priority 1: Direct JSON string
GOOGLE_OAUTH2_TOKENS='{"access_token":"ya29...","refresh_token":"1//0e..."}'

# Priority 2: Path to tokens.json
GOOGLE_OAUTH2_TOKEN_PATH=/path/to/tokens.json

# If neither is set, the server will search for tokens.json in:
# - ./tokens.json (current directory)
# - ../tokens.json (parent directory)
```

> **Important**: Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, the server can still work with valid tokens but won't be able to automatically refresh them when they expire. You'll need to manually update the tokens.

#### 4. Configuration Example

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "gsc": {
      "command": "npx",
      "args": ["-y", "mcp-server-gsc-pro"],
      "env": {
        "GOOGLE_AUTH_MODE": "oauth2",
        "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "GOCSPX-xxx",
        "GOOGLE_OAUTH2_TOKEN_PATH": "/path/to/tokens.json"
      }
    }
  }
}
```

#### 5. Auto Token Refresh

The server automatically refreshes expired access tokens using the refresh token:
- ✅ Monitors token expiration
- ✅ Automatically requests new access tokens
- ✅ Saves updated tokens to file (if using `GOOGLE_OAUTH2_TOKEN_PATH`)
- ✅ Updates tokens in memory (if using `GOOGLE_OAUTH2_TOKENS` env var)

No manual intervention required after initial setup!

---

### Additional Setup: Google Cloud API Key (Optional)

The `crux_query` and `crux_history` tools require a Google Cloud API key. All other 29 tools work without it.

This configuration is the same for both authentication modes:

The `crux_query` and `crux_history` tools require a Google Cloud API key. All other 29 tools work without it.

1. In the same Google Cloud project, enable the **Chrome UX Report API** — search for it in [APIs & Services > Library](https://console.cloud.google.com/apis/library) or go directly to the [Marketplace listing](https://console.cloud.google.com/marketplace/product/google/chromeuxreport.googleapis.com)
2. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials) and click **Create Credentials > API key**
3. Click the key name to edit it, then under **API restrictions** select **Restrict key** and choose only **Chrome UX Report API** — this limits exposure if the key leaks
4. Leave **Application restrictions** as **None** (the key is used server-side by Node.js, not from a browser)
5. Copy the key

The CrUX API is free with a 150 queries/minute limit. No billing required. Note that CrUX only has data for sites with sufficient traffic (roughly a few thousand monthly visits) — low-traffic sites will return empty results.

---

### Installation

```bash
npm install -g mcp-server-gsc-pro
```

Or run from source:

```bash
git clone https://github.com/ricardo-nth/mcp-server-gsc.git
cd mcp-server-gsc
pnpm install
pnpm build
```

### Running from Source

```json
{
  "mcpServers": {
    "gsc": {
      "command": "node",
      "args": ["/path/to/mcp-server-gsc-pro/dist/index.js"],
      "env": {
        "GOOGLE_AUTH_MODE": "service_account",
        "GOOGLE_CREDENTIALS_PATH": "/path/to/service-account.json",
        "GOOGLE_CLOUD_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Global Environment Variables

If you use the same credentials across multiple projects, you can export them in your shell config (e.g. `~/.zshrc` or `~/.bashrc`):

```bash
# For Service Account mode
export GOOGLE_CREDENTIALS_PATH="/path/to/service-account-key.json"
export GOOGLE_CLOUD_API_KEY="your-api-key-here"

# For OAuth2 mode
export GOOGLE_AUTH_MODE="oauth2"
export GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
export GOOGLE_OAUTH2_TOKEN_PATH="/path/to/tokens.json"
```

With global exports, your `.mcp.json` simplifies to:

```json
{
  "mcpServers": {
    "gsc": {
      "command": "npx",
      "args": ["-y", "mcp-server-gsc-pro"]
    }
  }
}
```

> The `env` block in `.mcp.json` takes precedence over shell environment variables, so you can still override per-project if needed.

---

## Tools (31)

### Core (9 tools)

| Tool | Description |
|------|-------------|
| `list_sites` | List all GSC properties accessible to the service account |
| `search_analytics` | Query clicks/impressions/CTR/position with filtering by page, query, country, device, search type |
| `enhanced_search_analytics` | Same + regex filters, quick-wins detection, auto-pagination up to 100K rows |
| `detect_quick_wins` | Find high-impression, low-CTR queries in striking distance (positions 4-10) |
| `index_inspect` | Check indexing status, crawl info, mobile usability, rich results for a URL |
| `list_sitemaps` | List submitted sitemaps |
| `get_sitemap` | Get details of a specific sitemap |
| `submit_sitemap` | Submit a new sitemap |
| `delete_sitemap` | Remove a sitemap |

### Computed Intelligence (7 tools)

Single-API tools that combine multiple queries into structured analysis.

| Tool | Description |
|------|-------------|
| `compare_periods` | Two-period side-by-side comparison with delta and % change for all metrics |
| `detect_content_decay` | Pages losing clicks over time, sorted by traffic loss |
| `detect_cannibalization` | Queries where multiple pages compete, with position variance analysis |
| `diff_keywords` | New and lost keywords between two time periods |
| `batch_inspect` | Inspect up to 100 URLs for indexing status (rate-limited 1/sec) |
| `ctr_analysis` | CTR vs position benchmarks to find underperforming queries |
| `search_type_breakdown` | Compare performance across web/image/video/discover/news |

### Multi-API Intelligence (5 tools)

Tools that combine data from multiple Google APIs in a single call, using `Promise.allSettled` for partial-failure tolerance.

| Tool | Description |
|------|-------------|
| `page_health_dashboard` | Unified page report: URL inspection + search analytics + PageSpeed Insights + CrUX |
| `indexing_health_report` | Batch indexing status for top pages with coverage aggregation and quota tracking |
| `serp_feature_tracking` | Monitor search appearance trends (rich results, FAQ, etc.) over time |
| `cannibalization_resolver` | Detect keyword cannibalization + recommend redirect/consolidate/differentiate |
| `drop_alerts` | Automated traffic/position drop detection with configurable thresholds |

### Adjacent APIs (10 tools)

Direct access to related Google APIs.

| Tool | Description |
|------|-------------|
| `get_site` | Get site property details (permission level, URL) |
| `add_site` | Add a new site property |
| `delete_site` | Remove a site property |
| `mobile_friendly_test` | Test a URL for mobile-friendliness with optional screenshot |
| `pagespeed_insights` | Lighthouse scores + CrUX field data (no auth required) |
| `indexing_publish` | Notify Google of URL updates/deletions (200/day quota) |
| `indexing_status` | Get Indexing API notification metadata for a URL |
| `crux_query` | Core Web Vitals (LCP, CLS, INP, FCP, TTFB) by URL or origin |
| `crux_history` | 40-week rolling CWV history by URL or origin |

## Common Parameters

**Flexible dates** — all date-based tools accept either:
- `startDate` + `endDate` (YYYY-MM-DD, validated)
- `days` (relative window ending yesterday, accounting for GSC data lag)

**Data freshness** — set `dataState: "all"` on analytics tools for data within hours instead of the default 2-3 day lag.

**Search types** — `web`, `image`, `video`, `news`, `discover`, `googleNews`.

**Auto-pagination** — `enhanced_search_analytics` and `detect_quick_wins` accept `maxRows` (up to 100,000) to fetch beyond the 25K per-request API limit.

**Error handling** — all errors return structured MCP payloads with `isError: true`, specific error codes (`AUTH_ERROR`, `QUOTA_ERROR`, `PERMISSION_ERROR`), and actionable messages.

## Environment Variables

### Authentication Mode

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_AUTH_MODE` | No | Authentication mode: `service_account` (default) or `oauth2` |

### Service Account Mode

| Variable | Required | Priority | Description |
|----------|----------|----------|-------------|
| `GOOGLE_CREDENTIALS` | No | 1 | Service account JSON as string |
| `GOOGLE_CREDENTIALS_PATH` | No | 2 | Path to service account JSON file |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | 3 | Path to service account JSON file (backward compatibility) |

> Set **one** of the above variables when using Service Account mode.

### OAuth2 Mode

| Variable | Required | Priority | Description |
|----------|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Recommended | - | OAuth2 client ID (required for token auto-refresh) |
| `GOOGLE_CLIENT_SECRET` | Recommended | - | OAuth2 client secret (required for token auto-refresh) |
| `GOOGLE_OAUTH2_TOKENS` | No | 1 | OAuth2 tokens as JSON string |
| `GOOGLE_OAUTH2_TOKEN_PATH` | No | 2 | Path to tokens.json file |

> If neither token variable is set, the server searches for `tokens.json` in the current and parent directories.
> 
> **Note on Client Credentials**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional but recommended. Without them, the server can still use existing valid tokens, but automatic token refresh will not work when the access token expires. You'll need to manually update the tokens.

### Optional (Both Modes)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLOUD_API_KEY` | No | Google Cloud API key for CrUX tools only |

## Development

```bash
pnpm install
pnpm build      # TypeScript compile to dist/
pnpm test       # Vitest (119 tests)
pnpm lint       # Type check only (tsc --noEmit)
```

CI runs on every PR: lint + test + build across Node 18, 20, 22.

## License

MIT
