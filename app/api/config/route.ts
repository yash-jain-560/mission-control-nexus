import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/config - Get system and agent configurations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    if (agentId) {
      // Get specific agent configuration
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          name: true,
          config: true,
          tokensAvailable: true,
          metadata: true,
        },
      });

      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }

      // Mask sensitive data
      const config = (agent.config as Record<string, any>) || {};

      return NextResponse.json({
        agentId: agent.id,
        name: agent.name,
        config: {
          model: config.model || process.env.DEFAULT_MODEL || 'unknown',
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 4000,
          topP: config.topP ?? 1,
          frequencyPenalty: config.frequencyPenalty ?? 0,
          presencePenalty: config.presencePenalty ?? 0,
          timeout: config.timeout ?? 30000,
          toolPolicy: config.toolPolicy || {
            enabledTools: [],
            disabledTools: [],
            requireConfirmation: [],
          },
          sessionSettings: config.sessionSettings || {
            maxDuration: 3600,
            maxTurns: 50,
            idleTimeout: 300,
          },
        },
        environment: {
          tokensAvailable: agent.tokensAvailable,
          nodeEnv: process.env.NODE_ENV || 'development',
        },
      });
    }

    // Get system-wide configuration
    const cronJobs = await prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        lastHeartbeat: true,
      },
      take: 100,
    });

    // Build system config response
    const systemConfig = {
      database: {
        type: 'postgresql',
        url: maskConnectionString(process.env.DATABASE_URL || ''),
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        file: process.env.LOG_FILE,
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      },
      ui: {
        theme: 'dark' as const,
        autoRefresh: true,
        refreshInterval: 5000,
      },
      gateway: {
        host: process.env.GATEWAY_HOST || 'localhost',
        port: parseInt(process.env.GATEWAY_PORT || '8080'),
        secure: process.env.GATEWAY_SECURE === 'true',
        apiKey: maskApiKey(process.env.GATEWAY_API_KEY || ''),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        vercelEnv: process.env.VERCEL_ENV || 'development',
      },
      agents: cronJobs.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        lastHeartbeat: agent.lastHeartbeat.toISOString(),
      })),
    };

    return NextResponse.json(systemConfig);
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
  }
}

// PATCH /api/config - Update configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, config } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    // Update agent configuration
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        config: {
          ...config,
          updatedAt: new Date().toISOString(),
        },
      },
      select: {
        id: true,
        name: true,
        config: true,
      },
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        config: agent.config,
      },
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }
}

// Helper to mask connection string
function maskConnectionString(url: string): string {
  if (!url) return '';
  try {
    // Simple masking for display - mask credentials in URL
    return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  } catch {
    return '***';
  }
}

// Helper to mask API key
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
