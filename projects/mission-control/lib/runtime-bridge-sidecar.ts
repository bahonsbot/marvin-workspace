function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function formatHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export type RuntimeBridgeSidecarDescriptor = {
  configured: boolean;
  localUrl: string | null;
  localHealthUrl: string | null;
  browserUrl: string | null;
  previewBrowserUrl: string | null;
  liveBrowserUrl: string | null;
  browserReachability: 'explicit' | 'loopback-only' | 'unavailable';
  token: string | null;
};

export function getRuntimeBridgeSidecarDescriptor(env: NodeJS.ProcessEnv): RuntimeBridgeSidecarDescriptor {
  const token = env.MISSION_CONTROL_WS_SIDECAR_TOKEN?.trim() || null;

  if (!token) {
    return {
      configured: false,
      localUrl: null,
      localHealthUrl: null,
      browserUrl: null,
      previewBrowserUrl: null,
      liveBrowserUrl: null,
      browserReachability: 'unavailable',
      token: null,
    };
  }

  const host = env.MISSION_CONTROL_WS_SIDECAR_HOST?.trim() || '127.0.0.1';
  const port = parsePort(env.MISSION_CONTROL_WS_SIDECAR_PORT, 3006);
  const path = env.MISSION_CONTROL_WS_SIDECAR_PATH?.trim() || '/mission-control-runtime';
  const publicPath = env.MISSION_CONTROL_WS_PUBLIC_PATH?.trim() || '/api/runtime-bridge/ws';
  const livePublicPath = env.MISSION_CONTROL_WS_LIVE_PUBLIC_PATH?.trim() || '/api/runtime-bridge/live';
  const localUrl = `ws://${formatHost(host)}:${port}${path}`;
  const localHealthUrl = `http://${formatHost(host)}:${port}/healthz`;
  const publicUrl = env.MISSION_CONTROL_WS_SIDECAR_PUBLIC_URL?.trim() || null;
  const livePublicUrl = env.MISSION_CONTROL_WS_LIVE_PUBLIC_URL?.trim() || null;
  const previewBrowserUrl = publicUrl ?? publicPath;
  const liveBrowserUrl = livePublicUrl ?? livePublicPath;

  return {
    configured: true,
    localUrl,
    localHealthUrl,
    browserUrl: previewBrowserUrl,
    previewBrowserUrl,
    liveBrowserUrl,
    browserReachability: 'explicit',
    token,
  };
}
