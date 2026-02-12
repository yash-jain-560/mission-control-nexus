import { NextRequest, NextResponse } from 'next/server';
import { getCostTrends, comparePeriods, getDailySummaries, detectCostAnomalies } from '@/lib/cost-analytics';
import { withActivityLogging } from '@/middleware/activity-logging';
import { prisma } from '@/lib/prisma';
import { MODEL_PRICING } from '@/lib/cost-calculator';

export const dynamic = 'force-dynamic';

// GET /api/cost/trends - Get cost trends and analysis
async function getTrends(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const includeBreakdowns = searchParams.get('breakdowns') !== 'false';
    const includeComparison = searchParams.get('comparison') === 'true';

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get trends
    const trends = await getCostTrends(days);

    // Get daily summaries
    const dailySummaries = await getDailySummaries(startDate, endDate);

    // Get model breakdown
    let modelBreakdown = null;
    if (includeBreakdowns) {
      const modelStats = await prisma.activity.groupBy({
        by: ['modelName'],
        where: {
          timestamp: { gte: startDate, lte: endDate },
        },
        _sum: {
          costTotal: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _count: {
          id: true,
        },
      });

      modelBreakdown = modelStats.map(stat => {
        const model = stat.modelName || 'unknown';
        const pricing = MODEL_PRICING[model] || { input: 0.01, output: 0.03 };
        
        return {
          model,
          cost: Number(stat._sum.costTotal) || 0,
          inputTokens: stat._sum.inputTokens || 0,
          outputTokens: stat._sum.outputTokens || 0,
          totalTokens: stat._sum.totalTokens || 0,
          activities: stat._count.id,
          pricing: {
            inputPer1K: pricing.input,
            outputPer1K: pricing.output,
          },
        };
      }).sort((a, b) => b.cost - a.cost);
    }

    // Get agent breakdown
    let agentBreakdown = null;
    if (includeBreakdowns) {
      const agentStats = await prisma.activity.groupBy({
        by: ['agentId'],
        where: {
          timestamp: { gte: startDate, lte: endDate },
        },
        _sum: {
          costTotal: true,
          totalTokens: true,
        },
        _count: {
          id: true,
        },
      });

      // Get agent names
      const agentIds = agentStats.map(s => s.agentId);
      const agents = await prisma.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true },
      });
      const agentNameMap = new Map(agents.map(a => [a.id, a.name]));

      agentBreakdown = agentStats.map(stat => ({
        agentId: stat.agentId,
        agentName: agentNameMap.get(stat.agentId) || stat.agentId,
        cost: Number(stat._sum.costTotal) || 0,
        tokens: stat._sum.totalTokens || 0,
        activities: stat._count.id,
      })).sort((a, b) => b.cost - a.cost);
    }

    // Get ticket breakdown
    let ticketBreakdown = null;
    if (includeBreakdowns) {
      const ticketStats = await prisma.activity.groupBy({
        by: ['ticketId'],
        where: {
          timestamp: { gte: startDate, lte: endDate },
          ticketId: { not: null },
        },
        _sum: {
          costTotal: true,
          totalTokens: true,
        },
        _count: {
          id: true,
        },
      });

      // Get ticket titles
      const ticketIds = ticketStats.map(s => s.ticketId).filter(Boolean) as string[];
      const tickets = await prisma.ticket.findMany({
        where: { id: { in: ticketIds } },
        select: { id: true, title: true },
      });
      const ticketTitleMap = new Map(tickets.map(t => [t.id, t.title]));

      ticketBreakdown = ticketStats.map(stat => ({
        ticketId: stat.ticketId,
        ticketTitle: ticketTitleMap.get(stat.ticketId!) || stat.ticketId,
        cost: Number(stat._sum.costTotal) || 0,
        tokens: stat._sum.totalTokens || 0,
        activities: stat._count.id,
      })).sort((a, b) => b.cost - a.cost);
    }

    // Detect anomalies
    const anomalies = await detectCostAnomalies(startDate, endDate);

    // Period comparison
    let comparison = null;
    if (includeComparison) {
      const previousEnd = new Date(startDate);
      const previousStart = new Date(previousEnd.getTime() - days * 24 * 60 * 60 * 1000);
      comparison = await comparePeriods(startDate, endDate, previousStart, previousEnd);
    }

    // Calculate summary stats
    const totalCost = trends.reduce((sum, t) => sum + t.cost, 0);
    const totalTokens = trends.reduce((sum, t) => sum + t.tokens, 0);
    const totalActivities = trends.reduce((sum, t) => sum + t.activities, 0);
    const avgDailyCost = totalCost / (trends.length || 1);
    const avgDailyTokens = totalTokens / (trends.length || 1);

    return NextResponse.json({
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalCost,
        formattedTotalCost: formatCurrency(totalCost),
        totalTokens,
        totalActivities,
        avgDailyCost,
        formattedAvgDailyCost: formatCurrency(avgDailyCost),
        avgDailyTokens: Math.round(avgDailyTokens),
        uniqueAgents: new Set(dailySummaries.flatMap(d => [d.topAgent])).size,
      },
      trends,
      dailySummaries,
      breakdowns: {
        byModel: modelBreakdown,
        byAgent: agentBreakdown,
        byTicket: ticketBreakdown,
      },
      anomalies: {
        count: anomalies.length,
        items: anomalies,
      },
      comparison,
      modelPricing: MODEL_PRICING,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching cost trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost trends' },
      { status: 500 }
    );
  }
}

// Format currency helper
function formatCurrency(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `<$0.01`;
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  return `$${(value / 1000).toFixed(2)}K`;
}

export const GET = withActivityLogging(getTrends, {
  activityType: 'api_call',
  agentId: 'system',
});