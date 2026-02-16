import { z } from 'zod';

/** list_sitemaps tool schema */
export const ListSitemapsSchema = z.object({
  siteUrl: z
    .string()
    .optional()
    .describe("Site URL including protocol, e.g. https://www.example.com/"),
  sitemapIndex: z
    .string()
    .optional()
    .describe('URL of a sitemap index to filter by'),
});

/** get_sitemap tool schema */
export const GetSitemapSchema = z.object({
  siteUrl: z
    .string()
    .optional()
    .describe("Site URL including protocol"),
  feedpath: z
    .string()
    .optional()
    .describe('URL of the sitemap, e.g. https://www.example.com/sitemap.xml'),
});

/** submit_sitemap tool schema */
export const SubmitSitemapSchema = z.object({
  siteUrl: z
    .string()
    .describe("Site URL including protocol"),
  feedpath: z
    .string()
    .describe('URL of the sitemap to submit'),
});

/** delete_sitemap tool schema */
export const DeleteSitemapSchema = z.object({
  siteUrl: z
    .string()
    .describe("Site URL including protocol"),
  feedpath: z
    .string()
    .describe('URL of the sitemap to delete'),
});

export type ListSitemapsInput = z.infer<typeof ListSitemapsSchema>;
export type GetSitemapInput = z.infer<typeof GetSitemapSchema>;
export type SubmitSitemapInput = z.infer<typeof SubmitSitemapSchema>;
export type DeleteSitemapInput = z.infer<typeof DeleteSitemapSchema>;
