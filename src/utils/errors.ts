import { GSCError, GSCPermissionError, GSCAuthError, GSCQuotaError } from '../service.js';

export interface AuthContext {
  mode: 'service_account' | 'oauth2';
  identity: string;
}

/**
 * Format authentication-aware error messages for better user guidance.
 */
export function formatAuthError(
  error: GSCError,
  authContext: AuthContext,
  siteUrl?: string,
): string {
  if (error instanceof GSCPermissionError) {
    if (authContext.mode === 'oauth2') {
      return JSON.stringify(
        {
          error: 'Permission denied for this Search Console property',
          siteUrl: siteUrl || error.message,
          authMode: 'oauth2',
          solution: 'The OAuth2 user does not have access to this property',
          steps: [
            '1. Verify the authorized user has access to this property in Search Console',
            '2. Check if the siteUrl is correct',
            '3. Re-authorize if needed to get fresh tokens',
          ],
          originalError: error.message,
        },
        null,
        2,
      );
    } else {
      return JSON.stringify(
        {
          error: 'Permission denied for this Search Console property',
          siteUrl: siteUrl || error.message,
          authMode: 'service_account',
          solution: `Please add the service account as a user in Search Console: ${authContext.identity}`,
          steps: [
            '1. Go to Google Search Console (search.google.com/search-console)',
            '2. Select the property',
            '3. Navigate to Settings > Users and permissions',
            `4. Add ${authContext.identity} with Owner or Full access`,
            '5. Try the query again',
          ],
          originalError: error.message,
        },
        null,
        2,
      );
    }
  }

  if (error instanceof GSCAuthError) {
    if (authContext.mode === 'oauth2') {
      return JSON.stringify(
        {
          error: 'OAuth2 authentication failed',
          authMode: 'oauth2',
          solution: 'Check your OAuth2 credentials and tokens',
          steps: [
            '1. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set',
            '2. Check tokens.json or GOOGLE_OAUTH2_TOKENS contains valid tokens',
            '3. Re-authorize if tokens have expired or been revoked',
          ],
          originalError: error.message,
        },
        null,
        2,
      );
    } else {
      return JSON.stringify(
        {
          error: 'Service Account authentication failed',
          authMode: 'service_account',
          solution: 'Check your service account credentials',
          steps: [
            '1. Verify GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CREDENTIALS, or GOOGLE_CREDENTIALS_PATH is set',
            '2. Ensure the JSON file contains a valid service account key',
            '3. Check the service account has not been deleted or disabled',
          ],
          originalError: error.message,
        },
        null,
        2,
      );
    }
  }

  if (error instanceof GSCQuotaError) {
    return JSON.stringify(
      {
        error: 'API quota exceeded',
        solution: 'Wait a moment and retry, or reduce request frequency',
        steps: [
          '1. Wait 60 seconds before retrying',
          '2. Reduce the frequency of API calls',
          '3. Check your Google Cloud Console quota limits',
        ],
        originalError: error.message,
      },
      null,
      2,
    );
  }

  // Generic error
  return JSON.stringify(
    {
      error: error.name || 'GSCError',
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    },
    null,
    2,
  );
}
