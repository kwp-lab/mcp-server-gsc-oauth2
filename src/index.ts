#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
// @ts-ignore — no types shipped
import { zodToJsonSchema } from 'zod-to-json-schema';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { GSCError, SearchConsoleService } from './service.js';
import { errorResult } from './utils/types.js';

// Schemas
import {
  SearchAnalyticsSchema,
  EnhancedSearchAnalyticsSchema,
  QuickWinsSchema,
} from './schemas/analytics.js';
import { IndexInspectSchema } from './schemas/inspection.js';
import {
  ListSitemapsSchema,
  GetSitemapSchema,
  SubmitSitemapSchema,
  DeleteSitemapSchema,
} from './schemas/sitemaps.js';
import {
  ComparePeriodsSchema,
  ContentDecaySchema,
  CannibalizationSchema,
  DiffKeywordsSchema,
  BatchInspectSchema,
  CtrAnalysisSchema,
  SearchTypeBreakdownSchema,
} from './schemas/computed.js';
import { GetSiteSchema, AddSiteSchema, DeleteSiteSchema } from './schemas/sites.js';
import { MobileFriendlyTestSchema } from './schemas/mobilefriendly.js';
import { PageSpeedInsightsSchema } from './schemas/pagespeed.js';
import { IndexingPublishSchema, IndexingStatusSchema } from './schemas/indexing.js';
import { CrUXQuerySchema, CrUXHistorySchema } from './schemas/crux.js';
import {
  PageHealthDashboardSchema,
  IndexingHealthReportSchema,
  SerpFeatureTrackingSchema,
  CannibalizationResolverSchema,
  DropAlertsSchema,
} from './schemas/computed2.js';

// Tool handlers
import {
  handleListSites,
  handleSearchAnalytics,
  handleEnhancedSearchAnalytics,
  handleDetectQuickWins,
} from './tools/analytics.js';
import { handleIndexInspect } from './tools/inspection.js';
import {
  handleListSitemaps,
  handleGetSitemap,
  handleSubmitSitemap,
  handleDeleteSitemap,
} from './tools/sitemaps.js';
import {
  handleComparePeriods,
  handleContentDecay,
  handleCannibalization,
  handleDiffKeywords,
  handleBatchInspect,
  handleCtrAnalysis,
  handleSearchTypeBreakdown,
} from './tools/computed.js';
import { handleGetSite, handleAddSite, handleDeleteSite } from './tools/sites.js';
import { handleMobileFriendlyTest } from './tools/mobilefriendly.js';
import { handlePageSpeedInsights } from './tools/pagespeed.js';
import { handleIndexingPublish, handleIndexingStatus } from './tools/indexing.js';
import { handleCrUXQuery, handleCrUXHistory } from './tools/crux.js';
import {
  handlePageHealthDashboard,
  handleIndexingHealthReport,
  handleSerpFeatureTracking,
  handleCannibalizationResolver,
  handleDropAlerts,
} from './tools/computed2.js';

// ---------------------------------------------------------------------------
// Environment & Authentication
// ---------------------------------------------------------------------------

// Authentication mode: 'service_account' (default) or 'oauth2'
const authMode = (process.env.GOOGLE_AUTH_MODE || 'service_account').toLowerCase() as
  | 'service_account'
  | 'oauth2';

// Helper function to load Service Account credentials
function loadCredentials(): { path: string; identity: string } {
  // Priority 1: GOOGLE_CREDENTIALS (JSON string) - create temp file
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      const tempPath = path.join(os.tmpdir(), `gsc-credentials-${Date.now()}.json`);
      fs.writeFileSync(tempPath, JSON.stringify(credentials));
      console.error('Loaded credentials from GOOGLE_CREDENTIALS environment variable');
      return {
        path: tempPath,
        identity: credentials.client_email || 'unknown service account',
      };
    } catch (error) {
      console.error(
        'Warning: Failed to parse GOOGLE_CREDENTIALS environment variable:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Priority 2: GOOGLE_CREDENTIALS_PATH
  if (process.env.GOOGLE_CREDENTIALS_PATH) {
    try {
      const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_CREDENTIALS_PATH);
      if (fs.existsSync(credentialsPath)) {
        const fileContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentials = JSON.parse(fileContent);
        console.error(`Loaded credentials from: ${credentialsPath}`);
        return {
          path: credentialsPath,
          identity: credentials.client_email || 'unknown service account',
        };
      } else {
        console.error(`Warning: Credentials file not found at: ${credentialsPath}`);
      }
    } catch (error) {
      console.error(
        'Warning: Failed to read GOOGLE_CREDENTIALS_PATH:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Priority 3: GOOGLE_APPLICATION_CREDENTIALS (fallback for backward compatibility)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (fs.existsSync(credentialsPath)) {
        const fileContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentials = JSON.parse(fileContent);
        console.error(`Loaded credentials from: ${credentialsPath}`);
        return {
          path: credentialsPath,
          identity: credentials.client_email || 'unknown service account',
        };
      }
    } catch (error) {
      console.error(
        'Warning: Failed to read GOOGLE_APPLICATION_CREDENTIALS:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  throw new Error(
    'Service Account credentials not found. Please set one of: GOOGLE_CREDENTIALS, GOOGLE_CREDENTIALS_PATH, or GOOGLE_APPLICATION_CREDENTIALS',
  );
}

// Helper function to load OAuth2 tokens from tokens.json or environment variable
function loadTokens(): { tokens: any; path: string | null } {
  // Priority 1: GOOGLE_OAUTH2_TOKENS (JSON string)
  if (process.env.GOOGLE_OAUTH2_TOKENS) {
    try {
      console.error('Loading tokens from GOOGLE_OAUTH2_TOKENS environment variable');
      const tokens = JSON.parse(process.env.GOOGLE_OAUTH2_TOKENS);
      return { tokens, path: null }; // path is null when using env var
    } catch (error) {
      console.error(
        'Warning: Failed to parse GOOGLE_OAUTH2_TOKENS environment variable:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Priority 2: Search multiple possible paths for tokens.json
  const possiblePaths = [
    process.env.GOOGLE_OAUTH2_TOKEN_PATH,
    path.resolve(process.cwd(), 'tokens.json'),
    path.resolve(process.cwd(), '../tokens.json'),
  ].filter((p): p is string => Boolean(p));

  for (const tokensPath of possiblePaths) {
    if (fs.existsSync(tokensPath)) {
      try {
        console.error(`Loading tokens from: ${tokensPath}`);
        const content = fs.readFileSync(tokensPath, 'utf8');
        return { tokens: JSON.parse(content), path: tokensPath };
      } catch (error) {
        console.error(
          `Warning: Failed to read tokens from ${tokensPath}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  throw new Error(
    `OAuth2 tokens not found. Set GOOGLE_OAUTH2_TOKENS env var or provide tokens.json. Searched paths: ${possiblePaths.join(', ')}`,
  );
}

// Initialize authentication based on mode
let service: SearchConsoleService;
let authIdentity: string;

const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
// Optional — only needed for CrUX tools. Server starts fine without it.

if (authMode === 'oauth2') {
  // OAuth2 mode: Use user authorization tokens
  console.error('=== OAuth2 Authentication Mode ===');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      'Warning: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.',
    );
    console.error(
      'Token auto-refresh will not work. You will need to manually update tokens when they expire.',
    );
  }

  const { tokens, path: tokensPath } = loadTokens();
  const oauth2Client = new OAuth2Client(clientId, clientSecret);

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    token_type: tokens.token_type,
    scope: tokens.scope,
  });

  // Auto-refresh tokens and save to file (if path is available)
  oauth2Client.on('tokens', (newTokens) => {
    console.error('OAuth2 tokens refreshed');
    const updatedTokens = {
      ...tokens,
      ...newTokens,
      expiry_date: newTokens.expiry_date || Date.now() + 3600 * 1000,
    };
    // Update in-memory tokens
    Object.assign(tokens, updatedTokens);

    // Only save to file if we have a file path
    if (tokensPath) {
      try {
        fs.writeFileSync(tokensPath, JSON.stringify(updatedTokens, null, 2));
        console.error('Tokens saved to file successfully');
      } catch (error) {
        console.error(
          'Warning: Failed to save tokens to file:',
          error instanceof Error ? error.message : String(error),
        );
      }
    } else {
      console.error('Tokens updated in memory (no file path available for persistence)');
    }
  });

  authIdentity = 'OAuth2 authorized user';
  service = new SearchConsoleService('oauth2', oauth2Client, GOOGLE_CLOUD_API_KEY, authIdentity);
  console.error(`Authenticated as: ${authIdentity}`);
} else {
  // Service Account mode (default)
  console.error('=== Service Account Authentication Mode ===');

  const { path: credentialsPath, identity } = loadCredentials();
  authIdentity = identity;

  service = new SearchConsoleService(
    'service_account',
    credentialsPath,
    GOOGLE_CLOUD_API_KEY,
    authIdentity,
  );
  console.error(`Authenticated as: ${authIdentity}`);
}

if (GOOGLE_CLOUD_API_KEY) {
  console.error('CrUX API Key: configured (crux_query and crux_history tools available)');
} else {
  console.error(
    'CrUX API Key: not configured (crux_query and crux_history tools will not work)',
  );
}
console.error('===================================');

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'mcp-server-gsc-pro', version: '1.2.0' },
  { capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'list_sites',
    description: 'List all sites available in Google Search Console',
    inputSchema: zodToJsonSchema(z.object({})),
  },
  {
    name: 'search_analytics',
    description:
      'Query search performance data (clicks, impressions, CTR, position) with filtering by page, query, country, device, and search type',
    inputSchema: zodToJsonSchema(SearchAnalyticsSchema),
  },
  {
    name: 'enhanced_search_analytics',
    description:
      'Advanced search analytics with regex filters, optional auto-pagination up to 100K rows, and optional quick-wins detection',
    inputSchema: zodToJsonSchema(EnhancedSearchAnalyticsSchema),
  },
  {
    name: 'detect_quick_wins',
    description:
      'Find SEO quick-win opportunities: high-impression, low-CTR queries in striking distance (positions 4-10), with optional auto-pagination up to 100K rows',
    inputSchema: zodToJsonSchema(QuickWinsSchema),
  },
  {
    name: 'index_inspect',
    description:
      'Inspect a URL for indexing status, crawl info, mobile usability, and rich results',
    inputSchema: zodToJsonSchema(IndexInspectSchema),
  },
  {
    name: 'list_sitemaps',
    description: 'List all sitemaps submitted for a site',
    inputSchema: zodToJsonSchema(ListSitemapsSchema),
  },
  {
    name: 'get_sitemap',
    description: 'Get details of a specific sitemap',
    inputSchema: zodToJsonSchema(GetSitemapSchema),
  },
  {
    name: 'submit_sitemap',
    description: 'Submit a new sitemap to Google Search Console',
    inputSchema: zodToJsonSchema(SubmitSitemapSchema),
  },
  {
    name: 'delete_sitemap',
    description: 'Delete a sitemap from Google Search Console',
    inputSchema: zodToJsonSchema(DeleteSitemapSchema),
  },
  // --- Computed intelligence tools ---
  {
    name: 'compare_periods',
    description:
      'Compare two time periods side-by-side with delta and % change for clicks, impressions, CTR, and position',
    inputSchema: zodToJsonSchema(ComparePeriodsSchema),
  },
  {
    name: 'detect_content_decay',
    description:
      'Find pages losing clicks over time by comparing recent vs earlier performance, sorted by traffic loss',
    inputSchema: zodToJsonSchema(ContentDecaySchema),
  },
  {
    name: 'detect_cannibalization',
    description:
      'Find queries where multiple pages compete for the same keyword, with position variance analysis',
    inputSchema: zodToJsonSchema(CannibalizationSchema),
  },
  {
    name: 'diff_keywords',
    description:
      'Discover new and lost keywords by comparing two time periods',
    inputSchema: zodToJsonSchema(DiffKeywordsSchema),
  },
  {
    name: 'batch_inspect',
    description:
      'Inspect multiple URLs for indexing status (rate-limited to 1/sec, max 100 URLs)',
    inputSchema: zodToJsonSchema(BatchInspectSchema),
  },
  {
    name: 'ctr_analysis',
    description:
      'Analyze CTR vs position benchmarks to find underperforming queries that could benefit from title/description optimization',
    inputSchema: zodToJsonSchema(CtrAnalysisSchema),
  },
  {
    name: 'search_type_breakdown',
    description:
      'Compare performance across search types (web, image, video, discover, news) in a single call',
    inputSchema: zodToJsonSchema(SearchTypeBreakdownSchema),
  },
  // --- Computed intelligence v2 ---
  {
    name: 'page_health_dashboard',
    description:
      'Comprehensive page health check combining URL Inspection (indexing status, canonical), Search Analytics (clicks, impressions, CTR, position), PageSpeed Insights (Lighthouse scores), and CrUX (real-user Core Web Vitals) in a single call. CrUX is optional (requires GOOGLE_CLOUD_API_KEY).',
    inputSchema: zodToJsonSchema(PageHealthDashboardSchema),
  },
  {
    name: 'indexing_health_report',
    description:
      'Batch-check indexing status across site pages. Gets top URLs from search analytics, rate-limited inspects each (1 req/sec), and aggregates: indexed count, not-indexed count, errors, by coverage state. Max 100 URLs per call. Reports quotaUsed for tracking against 2000/day limit.',
    inputSchema: zodToJsonSchema(IndexingHealthReportSchema),
  },
  {
    name: 'serp_feature_tracking',
    description:
      'Track SERP features (rich results, FAQs, videos, AMP, etc.) over time using the searchAppearance dimension. Shows daily trends per feature type.',
    inputSchema: zodToJsonSchema(SerpFeatureTrackingSchema),
  },
  {
    name: 'cannibalization_resolver',
    description:
      'Detect keyword cannibalization AND recommend actions: identifies the winner URL per query and suggests redirect, consolidate, or differentiate for competing pages based on traffic distribution.',
    inputSchema: zodToJsonSchema(CannibalizationResolverSchema),
  },
  {
    name: 'drop_alerts',
    description:
      'Detect pages with significant traffic drops by comparing recent vs previous period. Flags pages exceeding a configurable % threshold (default 50%), sorted by absolute click loss.',
    inputSchema: zodToJsonSchema(DropAlertsSchema),
  },
  // --- Sites CRUD ---
  {
    name: 'get_site',
    description:
      'Get details for a specific site property in Search Console (permission level, URL)',
    inputSchema: zodToJsonSchema(GetSiteSchema),
  },
  {
    name: 'add_site',
    description: 'Add a new site property to Google Search Console',
    inputSchema: zodToJsonSchema(AddSiteSchema),
  },
  {
    name: 'delete_site',
    description: 'Remove a site property from Google Search Console',
    inputSchema: zodToJsonSchema(DeleteSiteSchema),
  },
  // --- Mobile-Friendly Test ---
  {
    name: 'mobile_friendly_test',
    description:
      'Test a URL for mobile-friendliness and get issues with optional screenshot',
    inputSchema: zodToJsonSchema(MobileFriendlyTestSchema),
  },
  // --- PageSpeed Insights ---
  {
    name: 'pagespeed_insights',
    description:
      'Run Google PageSpeed Insights (Lighthouse) analysis on a URL — scores, field data, and diagnostics. No auth required.',
    inputSchema: zodToJsonSchema(PageSpeedInsightsSchema),
  },
  // --- Google Indexing API ---
  {
    name: 'indexing_publish',
    description:
      'Notify Google that a URL has been updated or deleted for faster crawling (Indexing API, 200/day quota). Note: officially limited to JobPosting/BroadcastEvent schema types.',
    inputSchema: zodToJsonSchema(IndexingPublishSchema),
  },
  {
    name: 'indexing_status',
    description:
      'Get Indexing API notification metadata for a URL — shows latest update/remove notifications. URL must have been previously submitted via indexing_publish.',
    inputSchema: zodToJsonSchema(IndexingStatusSchema),
  },
  // --- Chrome UX Report (CrUX) ---
  {
    name: 'crux_query',
    description:
      'Query Chrome UX Report for Core Web Vitals (LCP, CLS, INP, FCP, TTFB) by URL or origin. Requires GOOGLE_CLOUD_API_KEY env var.',
    inputSchema: zodToJsonSchema(CrUXQuerySchema),
  },
  {
    name: 'crux_history',
    description:
      'Query Chrome UX Report 40-week rolling history for Core Web Vitals trends by URL or origin. Requires GOOGLE_CLOUD_API_KEY env var.',
    inputSchema: zodToJsonSchema(CrUXHistorySchema),
  },
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS],
}));

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!args && name !== 'list_sites') {
      return errorResult({
        error: 'Arguments are required',
      });
    }

    switch (name) {
      case 'list_sites':
        return await handleListSites(service);
      case 'search_analytics':
        return await handleSearchAnalytics(service, args);
      case 'enhanced_search_analytics':
        return await handleEnhancedSearchAnalytics(service, args);
      case 'detect_quick_wins':
        return await handleDetectQuickWins(service, args);
      case 'index_inspect':
        return await handleIndexInspect(service, args);
      case 'list_sitemaps':
        return await handleListSitemaps(service, args);
      case 'get_sitemap':
        return await handleGetSitemap(service, args);
      case 'submit_sitemap':
        return await handleSubmitSitemap(service, args);
      case 'delete_sitemap':
        return await handleDeleteSitemap(service, args);
      // Computed intelligence tools
      case 'compare_periods':
        return await handleComparePeriods(service, args);
      case 'detect_content_decay':
        return await handleContentDecay(service, args);
      case 'detect_cannibalization':
        return await handleCannibalization(service, args);
      case 'diff_keywords':
        return await handleDiffKeywords(service, args);
      case 'batch_inspect':
        return await handleBatchInspect(service, args);
      case 'ctr_analysis':
        return await handleCtrAnalysis(service, args);
      case 'search_type_breakdown':
        return await handleSearchTypeBreakdown(service, args);
      // Computed intelligence v2
      case 'page_health_dashboard':
        return await handlePageHealthDashboard(service, args);
      case 'indexing_health_report':
        return await handleIndexingHealthReport(service, args);
      case 'serp_feature_tracking':
        return await handleSerpFeatureTracking(service, args);
      case 'cannibalization_resolver':
        return await handleCannibalizationResolver(service, args);
      case 'drop_alerts':
        return await handleDropAlerts(service, args);
      // Sites CRUD
      case 'get_site':
        return await handleGetSite(service, args);
      case 'add_site':
        return await handleAddSite(service, args);
      case 'delete_site':
        return await handleDeleteSite(service, args);
      // Mobile-Friendly Test
      case 'mobile_friendly_test':
        return await handleMobileFriendlyTest(service, args);
      // PageSpeed Insights
      case 'pagespeed_insights':
        return await handlePageSpeedInsights(service, args);
      // Indexing API
      case 'indexing_publish':
        return await handleIndexingPublish(service, args);
      case 'indexing_status':
        return await handleIndexingStatus(service, args);
      // CrUX
      case 'crux_query':
        return await handleCrUXQuery(service, args);
      case 'crux_history':
        return await handleCrUXHistory(service, args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResult({
        error: 'Invalid arguments',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    if (error instanceof GSCError) {
      return errorResult({
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    }
    if (error instanceof Error) {
      return errorResult({
        error: error.message,
      });
    }
    return errorResult({
      error: 'Unknown error',
      details: String(error),
    });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-server-gsc-pro running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
