import type { TickerProfile, TickerSourceName } from './contracts';

export interface TickerProfileSourceContext {
  symbol: string;
  now: Date;
}

export interface TickerProfileSourceResult {
  profile: TickerProfile;
  provider: TickerSourceName;
  fetchedAt: string;
}

export interface TickerProfileSource {
  id: TickerSourceName;
  label: string;
  fetchProfile(context: TickerProfileSourceContext): Promise<TickerProfileSourceResult | null>;
}

export function withProfileSource(profile: TickerProfile, provider: TickerSourceName, fetchedAt: string): TickerProfileSourceResult {
  return { profile, provider, fetchedAt };
}
