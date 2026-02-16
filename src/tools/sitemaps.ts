import { SearchConsoleService } from '../service.js';
import {
  ListSitemapsSchema,
  GetSitemapSchema,
  SubmitSitemapSchema,
  DeleteSitemapSchema,
} from '../schemas/sitemaps.js';
import { jsonResult, type ToolResult } from '../utils/types.js';

export async function handleListSitemaps(
  service: SearchConsoleService,
  raw: unknown,
): Promise<ToolResult> {
  const args = ListSitemapsSchema.parse(raw);
  const response = await service.listSitemaps({
    siteUrl: args.siteUrl,
    sitemapIndex: args.sitemapIndex,
  });
  return jsonResult(response.data);
}

export async function handleGetSitemap(
  service: SearchConsoleService,
  raw: unknown,
): Promise<ToolResult> {
  const args = GetSitemapSchema.parse(raw);
  const response = await service.getSitemap({
    siteUrl: args.siteUrl,
    feedpath: args.feedpath,
  });
  return jsonResult(response.data);
}

export async function handleSubmitSitemap(
  service: SearchConsoleService,
  raw: unknown,
): Promise<ToolResult> {
  const args = SubmitSitemapSchema.parse(raw);
  const response = await service.submitSitemap({
    siteUrl: args.siteUrl,
    feedpath: args.feedpath,
  });
  return jsonResult(response.data);
}

export async function handleDeleteSitemap(
  service: SearchConsoleService,
  raw: unknown,
): Promise<ToolResult> {
  const args = DeleteSitemapSchema.parse(raw);
  const response = await service.deleteSitemap({
    siteUrl: args.siteUrl,
    feedpath: args.feedpath,
  });
  return jsonResult(response.data);
}
