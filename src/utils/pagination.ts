import { SearchConsoleService } from '../service.js';
import type { SearchAnalyticsRow } from './types.js';

/**
 * Auto-paginate through Search Analytics results, fetching all rows beyond
 * the 25K single-request limit. Each page requests up to `pageSize` rows,
 * continuing until fewer rows are returned or `maxRows` is reached.
 */
export async function paginateSearchAnalytics(
  service: SearchConsoleService,
  siteUrl: string,
  body: Record<string, unknown>,
  opts: { maxRows?: number; pageSize?: number } = {},
): Promise<SearchAnalyticsRow[]> {
  const maxRows = opts.maxRows ?? 100_000;
  const pageSize = Math.min(opts.pageSize ?? 25_000, 25_000);
  const allRows: SearchAnalyticsRow[] = [];
  let startRow = 0;

  while (startRow < maxRows) {
    const limit = Math.min(pageSize, maxRows - startRow);
    const response = await service.searchAnalytics(siteUrl, {
      ...body,
      rowLimit: limit,
      startRow,
    });

    const data = response.data as { rows?: SearchAnalyticsRow[] };
    const rows = data.rows ?? [];
    allRows.push(...rows);

    // If we got fewer rows than requested, there are no more pages
    if (rows.length < limit) break;
    startRow += rows.length;
  }

  return allRows;
}
