import { z } from 'zod';
import { SiteUrlSchema } from './base.js';

/** index_inspect tool schema */
export const IndexInspectSchema = SiteUrlSchema.extend({
  inspectionUrl: z
    .string()
    .describe(
      'Fully-qualified URL to inspect. Must be under the property specified in siteUrl',
    ),
  languageCode: z
    .string()
    .optional()
    .default('en-US')
    .describe('IETF BCP-47 language code for translated messages (default: en-US)'),
});

export type IndexInspectInput = z.infer<typeof IndexInspectSchema>;
