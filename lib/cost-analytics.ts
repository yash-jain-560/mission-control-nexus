/**
 * Cost Analytics Module
 * Provides advanced cost analysis, anomaly detection, and budget forecasting
 */

import { prisma } from './prisma';
import { MODEL_PRICING, calculateCost, formatCost } from './cost-calculator';

export interface CostAnomaly {
  id: string;
  type: 'spike' | 'unusual_model' | 'high_token_usage' | 'budget_threshold';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  value: number;
  expectedValue: number;
  timestamp: Date;
  agentId?: string;
  modelName?: string;
}

export interface BudgetForecast {
  currentSpend: number;
  projectedMonthly: number;
  projectedDaily: number;
  remainingBudget: number;
  daysRemaining: number;
  atRisk: boolean;
  recommendedDailyBudget: number;
}

export interface ModelComparison {
  model: string;
  currentPeriod: {
    cost: number;
    tokens: number;
    activities: number;
  };
  previousPeriod: {
    cost: number;
    tokens: number;
    activities: number;
  };
  change: {
    cost: number;
    tokens: number;
    activities: number;
  };
}

export interface CostTrend {
  date: string;
  cost: number;
  tokens: number;
  activities: number;
  agents: number;
}

export interface DailySummary {
  date: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  activities: number;
  uniqueAgents: number;
  topModel: string;
  topAgent: string;
}

/**
 * Detect cost anomalies in the given time period
 */
export async function detectCostAnomalies(
  startDate: Date,
  endDate: Date,
  options: {
    budgetThreshold?: number;
    spikeThreshold?: number;
    minAnomalyCost?: number;
  } = {}
): Promise<CostAnomaly[]> {
  const { budgetThreshold = 0.8, spikeThreshold = 3, minAnomalyCost = 0.5 } = options;
  const anomalies: CostAnomaly[] = [];

  // Get daily costs for trend analysis
  const dailyCosts = await prisma.activity.groupBy({
    by: ['timestamp'],
    where: {
      timestamp: { gte: startDate, lte: endDate },
      costTotal: { not: null },
    },
    _sum: { costTotal: true },
    orderBy: { timestamp: 'asc' },
  });

  // Calculate average daily cost
  const dailyCostValues = dailyCosts.map(d => Number(d._sum.costTotal) || 0);
  const avgDailyCost = dailyCostValues.reduce((a, b) => a + b, 0) / dailyCostValues.length || 1;
  const stdDev = Math.sqrt(
    dailyCostValues.reduce((sq, n) => sq + Math.pow(n - avgDailyCost, 2), 0) / dailyCostValues.length
  );

  // Detect spikes
  dailyCosts.forEach((day, index) => {
    const cost = Number(day._sum.costTotal) || 0;
    if (cost > avgDailyCost + spikeThreshold * stdDev && cost > minAnomalyCost) {
      anomalies.push({
        id: `spike-${day.timestamp.toISOString()}`,
        type: 'spike',
        severity: cost > avgDailyCost + 5 * stdDev ? 'critical' : cost > avgDailyCost + 3 * stdDev ? 'high' : 'medium',
        description: `Cost spike detected: ${formatCost(cost)} (expected ~${formatCost(avgDailyCost)})`,
        value: cost,
        expectedValue: avgDailyCost,
        timestamp: day.timestamp,
      });
    }
  });

  // Detect unusual model usage
  const modelUsage = await prisma.activity.groupBy({
    by: ['modelName'],
    where: {
      timestamp: { gte: startDate, lte: endDate },
      costTotal: { not: null },
    },
    _sum: { costTotal: true },
  });

  const totalCost = modelUsage.reduce((sum, m) => sum + Number(m._sum.costTotal), 0);
  modelUsage.forEach(model => {
    const cost = Number(model._sum.costTotal) || 0;
    const percentage = totalCost > 0 ? cost / totalCost : 0;
    
    // Flag expensive models using >50% of budget
    if (percentage > 0.5 && cost > 10) {
      anomalies.push({
        id: `model-${model.modelName}`,
        type: 'unusual_model',
        severity: percentage > 0.8 ? 'high' : 'medium',
        description: `${model.modelName} accounts for ${(percentage * 100).toFixed(1)}% of costs`,
        value: cost,
        expectedValue: totalCost * 0.3, // Expect ~30% distribution
        timestamp: new Date(),
        modelName: model.modelName || undefined,
      });
    }
  });

  // Check budget threshold
  const periodBudget = 10 * Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const currentSpend = totalCost;
  const budgetUtilization = currentSpend / periodBudget;

  if (budgetUtilization > budgetThreshold) {
    anomalies.push({
      id: `budget-${new Date().toISOString()}`,
      type: 'budget_threshold',
      severity: budgetUtilization > 1 ? 'critical' : budgetUtilization > 0.9 ? 'high' : 'medium',
      description: `Budget ${budgetUtilization > 1 ? 'exceeded' : 'threshold reached'}: ${(budgetUtilization * 100).toFixed(1)}%`,
      value: currentSpend,
      expectedValue: periodBudget * budgetThreshold,
      timestamp: new Date(),
    });
  }

  return anomalies.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Generate budget forecast based on current spending patterns
 */
export async function generateBudgetForecast(
  dailyBudget: number = 10,
  daysToForecast: number = 30
): Promise<BudgetForecast> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = daysInMonth - daysElapsed + 1;

  // Get current month's spending
  const monthActivities = await prisma.activity.findMany({
    where: {
      timestamp: { gte: monthStart },
      costTotal: { not: null },
    },
    select: {
      costTotal: true,
      timestamp: true,
    },
  });

  const currentSpend = monthActivities.reduce((sum, a) => sum + Number(a.costTotal), 0);
  
  // Calculate daily average from this month
  const dailyAverage = daysElapsed > 0 ? currentSpend / daysElapsed : 0;
  
  // Project remaining month
  const projectedRemaining = dailyAverage * daysRemaining;
  const projectedMonthly = currentSpend + projectedRemaining;
  
  // Calculate monthly budget
  const monthlyBudget = dailyBudget * daysInMonth;
  const remainingBudget = Math.max(0, monthlyBudget - currentSpend);
  
  // Determine risk level
  const atRisk = projectedMonthly > monthlyBudget || (currentSpend / (dailyBudget * daysElapsed)) > 1.2;
  
  // Recommend daily budget to stay on track
  const recommendedDailyBudget = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

  return {
    currentSpend,
    projectedMonthly,
    projectedDaily: dailyAverage,
    remainingBudget,
    daysRemaining,
    atRisk,
    recommendedDailyBudget,
  };
}

/**
 * Compare current period with previous period
 */
export async function comparePeriods(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): Promise<{
  models: ModelComparison[];
  totalChange: { cost: number; tokens: number; activities: number };
}> {
  // Get current period data
  const [currentActivities, previousActivities] = await Promise.all([
    prisma.activity.findMany({
      where: {
        timestamp: { gte: currentStart, lte: currentEnd },
      },
      select: {
        modelName: true,
        costTotal: true,
        totalTokens: true,
      },
    }),
    prisma.activity.findMany({
      where: {
        timestamp: { gte: previousStart, lte: previousEnd },
      },
      select: {
        modelName: true,
        costTotal: true,
        totalTokens: true,
      },
    }),
  ]);

  // Aggregate by model
  const aggregateByModel = (activities: typeof currentActivities) => {
    const byModel: Record<string, { cost: number; tokens: number; activities: number }> = {};
    
    activities.forEach(a => {
      const model = a.modelName || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { cost: 0, tokens: 0, activities: 0 };
      }
      byModel[model].cost += Number(a.costTotal) || 0;
      byModel[model].tokens += a.totalTokens || 0;
      byModel[model].activities++;
    });
    
    return byModel;
  };

  const currentByModel = aggregateByModel(currentActivities);
  const previousByModel = aggregateByModel(previousActivities);

  // Build comparison
  const allModels = new Set([...Object.keys(currentByModel), ...Object.keys(previousByModel)]);
  const models: ModelComparison[] = [];

  allModels.forEach(model => {
    const current = currentByModel[model] || { cost: 0, tokens: 0, activities: 0 };
    const previous = previousByModel[model] || { cost: 0, tokens: 0, activities: 0 };

    models.push({
      model,
      currentPeriod: current,
      previousPeriod: previous,
      change: {
        cost: previous.cost > 0 ? ((current.cost - previous.cost) / previous.cost) * 100 : 100,
        tokens: previous.tokens > 0 ? ((current.tokens - previous.tokens) / previous.tokens) * 100 : 100,
        activities: previous.activities > 0 ? ((current.activities - previous.activities) / previous.activities) * 100 : 100,
      },
    });
  });

  // Calculate totals
  const currentTotal = Object.values(currentByModel).reduce((sum, m) => ({
    cost: sum.cost + m.cost,
    tokens: sum.tokens + m.tokens,
    activities: sum.activities + m.activities,
  }), { cost: 0, tokens: 0, activities: 0 });

  const previousTotal = Object.values(previousByModel).reduce((sum, m) => ({
    cost: sum.cost + m.cost,
    tokens: sum.tokens + m.tokens,
    activities: sum.activities + m.activities,
  }), { cost: 0, tokens: 0, activities: 0 });

  return {
    models: models.sort((a, b) => b.currentPeriod.cost - a.currentPeriod.cost),
    totalChange: {
      cost: previousTotal.cost > 0 ? ((currentTotal.cost - previousTotal.cost) / previousTotal.cost) * 100 : 100,
      tokens: previousTotal.tokens > 0 ? ((currentTotal.tokens - previousTotal.tokens) / previousTotal.tokens) * 100 : 100,
      activities: previousTotal.activities > 0 ? ((currentTotal.activities - previousTotal.activities) / previousTotal.activities) * 100 : 100,
    },
  };
}

/**
 * Get cost trends over time
 */
export async function getCostTrends(
  days: number = 30
): Promise<CostTrend[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const activities = await prisma.activity.findMany({
    where: {
      timestamp: { gte: startDate, lte: endDate },
    },
    select: {
      timestamp: true,
      costTotal: true,
      totalTokens: true,
      agentId: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  // Group by date
  const byDate: Record<string, { cost: number; tokens: number; activities: number; agents: Set<string> }> = {};

  activities.forEach(a => {
    const date = a.timestamp.toISOString().split('T')[0];
    if (!byDate[date]) {
      byDate[date] = { cost: 0, tokens: 0, activities: 0, agents: new Set() };
    }
    byDate[date].cost += Number(a.costTotal) || 0;
    byDate[date].tokens += a.totalTokens || 0;
    byDate[date].activities++;
    if (a.agentId) byDate[date].agents.add(a.agentId);
  });

  return Object.entries(byDate)
    .map(([date, data]) => ({
      date,
      cost: data.cost,
      tokens: data.tokens,
      activities: data.activities,
      agents: data.agents.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get daily summaries
 */
export async function getDailySummaries(
  startDate: Date,
  endDate: Date
): Promise<DailySummary[]> {
  const activities = await prisma.activity.findMany({
    where: {
      timestamp: { gte: startDate, lte: endDate },
    },
    select: {
      timestamp: true,
      costTotal: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      agentId: true,
      modelName: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  // Group by date
  const byDate: Record<string, {
    cost: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    activities: number;
    agents: Set<string>;
    models: Record<string, number>;
    agentCosts: Record<string, number>;
  }> = {};

  activities.forEach(a => {
    const date = a.timestamp.toISOString().split('T')[0];
    if (!byDate[date]) {
      byDate[date] = {
        cost: 0,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        activities: 0,
        agents: new Set(),
        models: {},
        agentCosts: {},
      };
    }
    
    byDate[date].cost += Number(a.costTotal) || 0;
    byDate[date].tokens += a.totalTokens || 0;
    byDate[date].inputTokens += a.inputTokens || 0;
    byDate[date].outputTokens += a.outputTokens || 0;
    byDate[date].activities++;
    
    if (a.agentId) {
      byDate[date].agents.add(a.agentId);
      if (!byDate[date].agentCosts[a.agentId]) byDate[date].agentCosts[a.agentId] = 0;
      byDate[date].agentCosts[a.agentId] += Number(a.costTotal) || 0;
    }
    
    const model = a.modelName || 'unknown';
    if (!byDate[date].models[model]) byDate[date].models[model] = 0;
    byDate[date].models[model] += Number(a.costTotal) || 0;
  });

  return Object.entries(byDate)
    .map(([date, data]) => {
      const topModel = Object.entries(data.models)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
      
      const topAgent = Object.entries(data.agentCosts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

      return {
        date,
        totalCost: data.cost,
        totalTokens: data.tokens,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        activities: data.activities,
        uniqueAgents: data.agents.size,
        topModel,
        topAgent,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Export cost data to CSV format
 */
export function exportToCsv(data: any[], filename: string = 'cost-data.csv'): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape values with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Get KPI data for the cost dashboard
 */
export async function getCostKPIs(): Promise<{
  today: {
    cost: number;
    tokens: number;
    activities: number;
    agents: number;
  };
  budget: {
    used: number;
    total: number;
    percentage: number;
  };
  projected: {
    monthly: number;
    daily: number;
  };
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  // Today's stats
  const todayActivities = await prisma.activity.findMany({
    where: {
      timestamp: { gte: today },
    },
    select: {
      costTotal: true,
      totalTokens: true,
      agentId: true,
    },
  });

  const todayCost = todayActivities.reduce((sum, a) => sum + Number(a.costTotal), 0);
  const todayTokens = todayActivities.reduce((sum, a) => sum + (a.totalTokens || 0), 0);
  const todayAgents = new Set(todayActivities.map(a => a.agentId)).size;

  // Monthly stats for projection
  const monthActivities = await prisma.activity.findMany({
    where: {
      timestamp: { gte: monthStart },
    },
    select: {
      costTotal: true,
    },
  });

  const monthCost = monthActivities.reduce((sum, a) => sum + Number(a.costTotal), 0);
  const dailyBudget = 10;
  const monthlyBudget = dailyBudget * daysInMonth;
  const budgetUsed = (monthCost / monthlyBudget) * 100;

  // Projections
  const dailyAverage = daysElapsed > 0 ? monthCost / daysElapsed : 0;
  const projectedMonthly = dailyAverage * daysInMonth;

  return {
    today: {
      cost: todayCost,
      tokens: todayTokens,
      activities: todayActivities.length,
      agents: todayAgents,
    },
    budget: {
      used: monthCost,
      total: monthlyBudget,
      percentage: Math.min(100, budgetUsed),
    },
    projected: {
      monthly: projectedMonthly,
      daily: dailyAverage,
    },
  };
}

export default {
  detectCostAnomalies,
  generateBudgetForecast,
  comparePeriods,
  getCostTrends,
  getDailySummaries,
  exportToCsv,
  getCostKPIs,
};