import { NextRequest, NextResponse } from 'next/server';
import { getCostKPIs, generateBudgetForecast, detectCostAnomalies } from '@/lib/cost-analytics';
import { withActivityLogging } from '@/middleware/activity-logging';

export const dynamic = 'force-dynamic';

// GET /api/cost/kpis - Get cost KPIs
async function getKPIs(request: NextRequest) {
  try {
    const [kpis, forecast, anomalies] = await Promise.all([
      getCostKPIs(),
      generateBudgetForecast(),
      detectCostAnomalies(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      ),
    ]);

    // Calculate derived metrics
    const avgCostPerAgent = kpis.today.agents > 0 
      ? kpis.today.cost / kpis.today.agents 
      : 0;

    const avgTokensPerActivity = kpis.today.activities > 0
      ? kpis.today.tokens / kpis.today.activities
      : 0;

    return NextResponse.json({
      // Main KPIs
      today: {
        cost: kpis.today.cost,
        formattedCost: formatCurrency(kpis.today.cost),
        tokens: kpis.today.tokens,
        activities: kpis.today.activities,
        agents: kpis.today.agents,
      },
      
      // Budget metrics
      budget: {
        used: kpis.budget.used,
        formattedUsed: formatCurrency(kpis.budget.used),
        total: kpis.budget.total,
        formattedTotal: formatCurrency(kpis.budget.total),
        percentage: kpis.budget.percentage,
        remaining: kpis.budget.total - kpis.budget.used,
        formattedRemaining: formatCurrency(kpis.budget.total - kpis.budget.used),
      },
      
      // Projections
      projected: {
        monthly: kpis.projected.monthly,
        formattedMonthly: formatCurrency(kpis.projected.monthly),
        daily: kpis.projected.daily,
        formattedDaily: formatCurrency(kpis.projected.daily),
        atRisk: forecast.atRisk,
        recommendedDailyBudget: forecast.recommendedDailyBudget,
        formattedRecommendedDaily: formatCurrency(forecast.recommendedDailyBudget),
      },
      
      // Derived metrics
      metrics: {
        avgCostPerAgent,
        formattedAvgCostPerAgent: formatCurrency(avgCostPerAgent),
        avgTokensPerActivity: Math.round(avgTokensPerActivity),
        costPer1KTokens: kpis.today.tokens > 0 
          ? (kpis.today.cost / kpis.today.tokens) * 1000 
          : 0,
        formattedCostPer1KTokens: kpis.today.tokens > 0
          ? formatCurrency((kpis.today.cost / kpis.today.tokens) * 1000)
          : '$0.00',
      },
      
      // Anomalies
      anomalies: anomalies.slice(0, 5), // Top 5 anomalies
      anomalyCount: anomalies.length,
      
      // Timestamp
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching cost KPIs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost KPIs' },
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

export const GET = withActivityLogging(getKPIs, {
  activityType: 'api_call',
  agentId: 'system',
});