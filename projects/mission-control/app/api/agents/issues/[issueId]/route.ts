import { NextRequest, NextResponse } from 'next/server';
import { setAgentIssueState } from '@/lib/adapters/agent-issues';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params;
    const body = await request.json().catch(() => ({}));
    const state = body?.state;

    if (state !== 'active' && state !== 'acknowledged') {
      return NextResponse.json({ error: 'state must be active or acknowledged' }, { status: 400 });
    }

    const result = await setAgentIssueState(issueId, state);
    return NextResponse.json({ status: 'ok', issue: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update issue state.';
    const status = message === 'INVALID_ISSUE_ID' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
