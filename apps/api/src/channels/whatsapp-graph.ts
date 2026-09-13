import { ConfigService } from '@nestjs/config';

/**
 * Graph API version for WhatsApp calls when WHATSAPP_GRAPH_API_VERSION is
 * unset. Meta retires each version about two years after release (v25.0 is
 * supported until July 2028), so it stays configurable rather than pinned.
 */
export const DEFAULT_GRAPH_API_VERSION = 'v25.0';

export function graphApiVersion(config: ConfigService): string {
  return config.get<string>('WHATSAPP_GRAPH_API_VERSION') || DEFAULT_GRAPH_API_VERSION;
}
