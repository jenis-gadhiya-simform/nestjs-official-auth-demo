import type { ConfigService } from '@nestjs/config';
import {
  google,
  microsoft,
  type OidcProviderConfig,
} from '@nestjs/authentication';

/** Google and Microsoft, each enabled only when its credentials are in .env. */
export function oidcProviders(config: ConfigService) {
  const providers: Record<string, OidcProviderConfig> = {};

  const googleId = config.get<string>('GOOGLE_CLIENT_ID');
  const googleSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
  if (googleId && googleSecret) {
    providers.google = google({
      clientId: googleId,
      clientSecret: googleSecret,
    });
  }

  const microsoftId = config.get<string>('MICROSOFT_CLIENT_ID');
  const microsoftSecret = config.get<string>('MICROSOFT_CLIENT_SECRET');
  const tenant = config.get<string>('MICROSOFT_TENANT_ID');
  if (microsoftId && microsoftSecret && tenant) {
    // `tenant` is your directory id (a GUID); `common` and `consumers` are not supported.
    providers.microsoft = microsoft({
      clientId: microsoftId,
      clientSecret: microsoftSecret,
      tenant,
    });
  }

  return providers;
}
