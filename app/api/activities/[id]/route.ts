import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/activities/[id] - Get full activity details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: params.id },
      include: {
        ticket: true,
      },
    });
    
    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: activity.id,
      agentId: activity.agentId,
      type: activity.activityType,
      description: activity.description,
      timestamp: activity.timestamp.toISOString(),
      tokens: activity.inputTokens + activity.outputTokens,
      inputTokens: activity.inputTokens,
      outputTokens: activity.outputTokens,
      duration: activity.duration,
      toolName: activity.toolName,
      // Full details for modal view
      inputPrompt: activity.inputPrompt,
      output: activity.output,
      toolInput: activity.toolInput,
      toolOutput: activity.toolOutput,
      ticket: activity.ticket,
      metadata: activity.metadata,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
