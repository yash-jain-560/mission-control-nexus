import { NextRequest, NextResponse } from 'next/server';

// GET /api/health - Simple health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
}
