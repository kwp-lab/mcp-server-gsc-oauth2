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

import { SearchConsoleService } from './service.js';

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

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'GOOGLE_APPLICATION_CREDENTIALS environment variable is required',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'mcp-server-gsc-pro', version: '1.0.0' },
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
      'Advanced search analytics with regex filters, up to 25K rows, and optional quick-wins detection',
    inputSchema: zodToJsonSchema(EnhancedSearchAnalyticsSchema),
  },
  {
    name: 'detect_quick_wins',
    description:
      'Find SEO quick-win opportunities: high-impression, low-CTR queries in striking distance (positions 4-10)',
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
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS],
}));

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args && name !== 'list_sites') {
    throw new Error('Arguments are required');
  }

  const service = new SearchConsoleService(GOOGLE_APPLICATION_CREDENTIALS);

  try {
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
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`,
      );
    }
    throw error;
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
