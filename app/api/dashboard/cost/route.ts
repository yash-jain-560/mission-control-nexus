import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';
import { aggregateAllTokens } from '@/lib/token-aggregator';
import { MODEL_PRICING, formatCost } from '@/lib/cost-calculator';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/cost - Get comprehensive cost tracking data
async function getCostDashboard(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d'; // 1d, 7d, 30d, all
    const detailed = searchParams.get('detailed') === 'true';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get aggregated token data
    const tokenAggregation = await aggregateAllTokens();

    // Get activities in the period for detailed breakdown
    const [periodActivities, allTimeActivities] = await Promise.all([
      prisma.activity.findMany({
        where: {
          timestamp: { gte: startDate },
        },
        select: {
          id: true,
          agentId: true,
          ticketId: true,
          modelName: true,
          activityType: true,
          inputTokens: true,
          outputTokens: true,
          costTotal: true,
          costInput: true,
          costOutput: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
      }),
      detailed ? prisma.activity.findMany({
        select: {
          id: true,
          agentId: true,
          ticketId: true,
          modelName: true,
          activityType: true,
          inputTokens: true,
          outputTokens: true,
          costTotal: true,
          timestamp: true,
        },
      }) : Promise.resolve([]),
    ]);

    // Calculate period costs
    const periodStats = periodActivities.reduce((acc, activity) => {
      const input = activity.inputTokens || 0;
      const output = activity.outputTokens || 0;
      const cost = activity.costTotal || 0;

      acc.totalInput += input;
      acc.totalOutput += output;
      acc.totalCost += cost;
      acc.activities++;

      // By model
      const model = activity.modelName || 'unknown';
      if (!acc.byModel[model]) {
        acc.byModel[model] = { input: 0, output: 0, cost: 0, activities: 0 };
      }
      acc.byModel[model].input += input;
      acc.byModel[model].output += output;
      acc.byModel[model].cost += cost;
      acc.byModel[model].activities++;

      // By agent
      if (activity.agentId) {
        if (!acc.byAgent[activity.agentId]) {
          acc.byAgent[activity.agentId] = { input: 0, output: 0, cost: 0, activities: 0 };
        }
        acc.byAgent[activity.agentId].input += input;
        acc.byAgent[activity.agentId].output += output;
        acc.byAgent[activity.agentId].cost += cost;
        acc.byAgent[activity.agentId].activities++;
      }

      // By ticket
      if (activity.ticketId) {
        if (!acc.byTicket[activity.ticketId]) {
          acc.byTicket[activity.ticketId] = { input: 0, output: 0, cost: 0, activities: 0 };
        }
        acc.byTicket[activity.ticketId].input += input;
        acc.byTicket[activity.ticketId].output += output;
        acc.byTicket[activity.ticketId].cost += cost;
        acc.byTicket[activity.ticketId].activities++;
      }

      // By day
      const day = activity.timestamp.toISOString().split('T')[0];
      if (!acc.byDay[day]) {
        acc.byDay[day] = { input: 0, output: 0, cost: 0, activities: 0 };
      }
      acc.byDay[day].input += input;
      acc.byDay[day].output += output;
      acc.byDay[day].cost += cost;
      acc.byDay[day].activities++;

      return acc;
    }, {
      totalInput: 0,
      totalOutput: 0,
      totalCost: 0,
      activities: 0,
      byModel: {} as Record<string, { input: number; output: number; cost: number; activities: number }>,
      byAgent: {} as Record<string, { input: number; output: number; cost: number; activities: number }>,
      byTicket: {} as Record<string, { input: number; output: number; cost: number; activities: number }>,
      byDay: {} as Record<string, { input: number; output: number; cost: number; activities: number }>,
    });

    // Get agent names for the breakdown
    const agentIds = Object.keys(periodStats.byAgent);
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map(a => [a.id, a.name]));

    // Get ticket titles for the breakdown
    const ticketIds = Object.keys(periodStats.byTicket);
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds } },
      select: { id: true, title: true },
    });
    const ticketTitleMap = new Map(tickets.map(t => [t.id, t.title]));

    // Enhance model breakdown with pricing info
    const modelBreakdown = Object.entries(periodStats.byModel).map(([model, stats]) => {
      const pricing = MODEL_PRICING[model] || { input: 0.01, output: 0.03 };
      return {
        model,
        inputTokens: stats.input,
        outputTokens: stats.output,
        totalTokens: stats.input + stats.output,
        cost: stats.cost,
        activities: stats.activities,
        pricing: {
          inputPer1K: pricing.input,
          outputPer1K: pricing.output,
        },
      };
    }).sort((a, b) => b.cost - a.cost);

    // Enhance agent breakdown with names
    const agentBreakdown = Object.entries(periodStats.byAgent).map(([agentId, stats]) => ({
      agentId,
      agentName: agentNameMap.get(agentId) || agentId,
      inputTokens: stats.input,
      outputTokens: stats.output,
      totalTokens: stats.input + stats.output,
      cost: stats.cost,
      activities: stats.activities,
    })).sort((a, b) => b.cost - a.cost);

    // Enhance ticket breakdown with titles
    const ticketBreakdown = Object.entries(periodStats.byTicket).map(([ticketId, stats]) => ({
      ticketId,
      ticketTitle: ticketTitleMap.get(ticketId) || ticketId,
      inputTokens: stats.input,
      outputTokens: stats.output,
      totalTokens: stats.input + stats.output,
      cost: stats.cost,
      activities: stats.activities,
    })).sort((a, b) => b.cost - a.cost);

    // Daily time series data
    const dailyData = Object.entries(periodStats.byDay)
      .map(([date, stats]) => ({
        date,
        inputTokens: stats.input,
        outputTokens: stats.output,
        totalTokens: stats.input + stats.output,
        cost: stats.cost,
        activities: stats.activities,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate all-time stats if detailed
    let allTimeStats = null;
    if (detailed && allTimeActivities.length > 0) {
      allTimeStats = allTimeActivities.reduce((acc, activity) => {
        acc.totalInput += activity.inputTokens || 0;
        acc.totalOutput += activity.outputTokens || 0;
        acc.totalCost += activity.costTotal || 0;
        return acc;
      }, { totalInput: 0, totalOutput: 0, totalCost: 0 });
    }

    // Budget calculation (example: $10/day budget)
    const dailyBudget = 10.0;
    const budgetUtilization = (periodStats.totalCost / (dailyBudget * (period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 30))) * 100;

    return NextResponse.json({
      period,
      periodStart: startDate.toISOString(),
      periodEnd: now.toISOString(),
      summary: {
        totalInputTokens: periodStats.totalInput,
        totalOutputTokens: periodStats.totalOutput,
        totalTokens: periodStats.totalInput + periodStats.totalOutput,
        totalCost: periodStats.totalCost,
        formattedCost: formatCost(periodStats.totalCost),
        totalActivities: periodStats.activities,
        averageCostPerActivity: periodStats.activities > 0 
          ? periodStats.totalCost / periodStats.activities 
          : 0,
        averageTokensPerActivity: periodStats.activities > 0
          ? (periodStats.totalInput + periodStats.totalOutput) / periodStats.activities
          : 0,
      },
      budget: {
        dailyBudget,
        periodBudget: dailyBudget * (period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 30),
        spent: periodStats.totalCost,
        remaining: Math.max(0, dailyBudget * (period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 30) - periodStats.totalCost),
        utilization: Math.min(100, budgetUtilization),
      },
      breakdowns: {
        byModel: modelBreakdown,
        byAgent: agentBreakdown,
        byTicket: ticketBreakdown,
        byDay: dailyData,
      },
      modelPricing: MODEL_PRICING,
      allTime: allTimeStats ? {
        totalInputTokens: allTimeStats.totalInput,
        totalOutputTokens: allTimeStats.totalOutput,
        totalTokens: allTimeStats.totalInput + allTimeStats.totalOutput,
        totalCost: allTimeStats.totalCost,
        formattedCost: formatCost(allTimeStats.totalCost),
      } : null,
    });
  } catch (error) {
    console.error('Error fetching cost dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch cost dashboard' }, { status: 500 });
  }
}

// Wrap with activity logging
export const GET = withActivityLogging(getCostDashboard, { 
  activityType: 'api_call',
  agentId: 'system'
});