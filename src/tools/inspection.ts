import { SearchConsoleService } from '../service.js';
import { IndexInspectSchema } from '../schemas/inspection.js';
import { jsonResult, type ToolResult } from '../utils/types.js';

export async function handleIndexInspect(
  service: SearchConsoleService,
  raw: unknown,
): Promise<ToolResult> {
  const args = IndexInspectSchema.parse(raw);
  const response = await service.indexInspect({
    siteUrl: args.siteUrl,
    inspectionUrl: args.inspectionUrl,
    languageCode: args.languageCode,
  });
  return jsonResult(response.data);
}
