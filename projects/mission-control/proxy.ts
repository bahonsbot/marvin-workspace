import { NextRequest, NextResponse } from 'next/server';

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function isLocalRequest(request: NextRequest): boolean {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = request.headers.get('host')?.split(':')[0]?.trim();

  return [forwardedFor, forwardedHost, hostHeader].some((value) => value ? LOCAL_HOSTS.has(value) : false);
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Mission Control"',
      'Cache-Control': 'no-store',
    },
  });
}

function misconfiguredResponse(): NextResponse {
  return new NextResponse('Mission Control auth is not configured', {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export function proxy(request: NextRequest) {
  if (isLocalRequest(request)) {
    return NextResponse.next();
  }

  const expectedUser = process.env.MISSION_CONTROL_BASIC_AUTH_USER;
  const expectedPass = process.env.MISSION_CONTROL_BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return misconfiguredResponse();
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  const encoded = authHeader.slice('Basic '.length).trim();
  let decoded = '';

  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return unauthorizedResponse();
  }

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  if (user !== expectedUser || pass !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
