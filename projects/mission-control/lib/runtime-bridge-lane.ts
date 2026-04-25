export type RuntimeBridgeLane = 'preview' | 'lab' | 'live';

type HeaderReader = {
  get(name: string): string | null | undefined;
};

function normalizeHost(rawHost: string | null | undefined): string | null {
  const value = rawHost?.split(',')[0]?.trim();
  if (!value) return null;

  try {
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return value.replace(/:\d+$/, '').toLowerCase();
  }
}

function isLoopbackHost(hostname: string | null): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isPreviewHost(hostname: string | null): boolean {
  if (!hostname) return false;
  return hostname === 'preview.motiondisplay.cloud' || isLoopbackHost(hostname);
}

function isLabHost(hostname: string | null): boolean {
  return hostname === 'lab.motiondisplay.cloud';
}

export function resolveRuntimeBridgeLaneFromHost(host: string | null | undefined): RuntimeBridgeLane {
  const hostname = normalizeHost(host);
  if (isPreviewHost(hostname)) return 'preview';
  if (isLabHost(hostname)) return 'lab';
  return 'live';
}

export function resolveRuntimeBridgeLaneFromHeaders(headers: HeaderReader): RuntimeBridgeLane {
  return resolveRuntimeBridgeLaneFromHost(headers.get('x-forwarded-host') ?? headers.get('host'));
}
