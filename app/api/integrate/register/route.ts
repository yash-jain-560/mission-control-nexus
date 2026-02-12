import { NextRequest, NextResponse } from "next/server";
import { initializeIntegration } from "@/lib/openclaw-integration";

/**
 * POST /api/integrate/register
 * Registers an OpenClaw agent and starts heartbeat monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { agentName?: string };
    const agentName = body.agentName || "Orbit";

    const integration = await initializeIntegration(agentName);
    const agentInfo = integration.getAgentInfo();

    return NextResponse.json(
      {
        success: true,
        message: `Agent "${agentName}" registered and monitoring started`,
        agentId: agentInfo.id,
        agentName: agentInfo.name,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
