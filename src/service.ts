import { google, searchconsole_v1, webmasters_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

type SearchAnalyticsRequest =
  webmasters_v3.Params$Resource$Searchanalytics$Query['requestBody'];
type ListSitemapsParams = webmasters_v3.Params$Resource$Sitemaps$List;
type GetSitemapParams = webmasters_v3.Params$Resource$Sitemaps$Get;
type SubmitSitemapParams = webmasters_v3.Params$Resource$Sitemaps$Submit;
type DeleteSitemapParams = webmasters_v3.Params$Resource$Sitemaps$Delete;
type InspectRequest =
  searchconsole_v1.Params$Resource$Urlinspection$Index$Inspect['requestBody'];

export class SearchConsoleService {
  private auth: GoogleAuth;

  constructor(credentials: string) {
    this.auth = new google.auth.GoogleAuth({
      keyFile: credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async getWebmasters() {
    const authClient = await this.auth.getClient();
    return google.webmasters({
      version: 'v3',
      auth: authClient,
    } as webmasters_v3.Options);
  }

  private async getSearchConsole() {
    const authClient = await this.auth.getClient();
    return google.searchconsole({
      version: 'v1',
      auth: authClient,
    } as searchconsole_v1.Options);
  }

  /**
   * Attempt to normalize a URL to sc-domain format for permission fallback.
   * If the URL is already sc-domain:, returns it as-is.
   */
  private normalizeUrl(url: string): string {
    if (url.startsWith('sc-domain:')) return url;
    try {
      const parsed = new URL(url);
      return `sc-domain:${parsed.hostname}`;
    } catch {
      return url;
    }
  }

  /**
   * Try an operation; if it fails with a permission error, retry with
   * normalized URL. This handles cases where the user provides a URL-prefix
   * property but only has domain-level access, or vice versa.
   */
  private async withPermissionFallback<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes('permission')
      ) {
        return await fallback();
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Sites
  // ---------------------------------------------------------------------------

  async listSites() {
    const wm = await this.getWebmasters();
    return wm.sites.list();
  }

  // ---------------------------------------------------------------------------
  // Search Analytics
  // ---------------------------------------------------------------------------

  async searchAnalytics(siteUrl: string, body: SearchAnalyticsRequest) {
    const wm = await this.getWebmasters();
    return this.withPermissionFallback(
      () => wm.searchanalytics.query({ siteUrl, requestBody: body }),
      () =>
        wm.searchanalytics.query({
          siteUrl: this.normalizeUrl(siteUrl),
          requestBody: body,
        }),
    );
  }

  // ---------------------------------------------------------------------------
  // URL Inspection
  // ---------------------------------------------------------------------------

  async indexInspect(body: InspectRequest) {
    const sc = await this.getSearchConsole();
    return sc.urlInspection.index.inspect({ requestBody: body });
  }

  // ---------------------------------------------------------------------------
  // Sitemaps
  // ---------------------------------------------------------------------------

  async listSitemaps(params: ListSitemapsParams) {
    const wm = await this.getWebmasters();
    return this.withPermissionFallback(
      () => wm.sitemaps.list(params),
      () =>
        wm.sitemaps.list({
          ...params,
          siteUrl: this.normalizeUrl(params.siteUrl!),
        }),
    );
  }

  async getSitemap(params: GetSitemapParams) {
    const wm = await this.getWebmasters();
    return this.withPermissionFallback(
      () => wm.sitemaps.get(params),
      () =>
        wm.sitemaps.get({
          ...params,
          siteUrl: this.normalizeUrl(params.siteUrl!),
        }),
    );
  }

  async submitSitemap(params: SubmitSitemapParams) {
    const wm = await this.getWebmasters();
    return this.withPermissionFallback(
      () => wm.sitemaps.submit(params),
      () =>
        wm.sitemaps.submit({
          ...params,
          siteUrl: this.normalizeUrl(params.siteUrl!),
        }),
    );
  }

  async deleteSitemap(params: DeleteSitemapParams) {
    const wm = await this.getWebmasters();
    return this.withPermissionFallback(
      () => wm.sitemaps.delete(params),
      () =>
        wm.sitemaps.delete({
          ...params,
          siteUrl: this.normalizeUrl(params.siteUrl!),
        }),
    );
  }
}
