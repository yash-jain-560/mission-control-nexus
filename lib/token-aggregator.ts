/**
 * Token Aggregator Module
 * Properly aggregates tokens across all agents, tickets, and activities
 * Fixes the token display issues showing wrong totals
 */

import { prisma } from './prisma';

export interface TokenAggregationResult {
  // Raw counts from database
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  
  // Breakdown by source
  byAgent: Record<string, {
    input: number;
    output: number;
    total: number;
    activities: number;
  }>;
  
  byTicket: Record<string, {
    input: number;
    output: number;
    total: number;
    activities: number;
  }>;
  
  byModel: Record<string, {
    input: number;
    output: number;
    total: number;
    cost: number;
  }>;
  
  // Time-based aggregation
  byDay: Record<string, {
    input: number;
    output: number;
    total: number;
  }>;
  
  // Cost information
  totalCost: number;
  estimatedCostByModel: Record<string, number>;
  
  // Metadata
  totalActivities: number;
  activitiesWithTokens: number;
  lastUpdated: string;
}

/**
 * Aggregate all tokens across the system
 * This is the CORRECT way to count tokens - directly from activities
 */
export async function aggregateAllTokens(): Promise<TokenAggregationResult> {
  try {
    // Get ALL activities with token data
    const activities = await prisma.activity.findMany({
      select: {
        id: true,
        agentId: true,
        ticketId: true,
        modelName: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costTotal: true,
        timestamp: true,
      },
    });

    // Initialize result structure
    const result: TokenAggregationResult = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      byAgent: {},
      byTicket: {},
      byModel: {},
      byDay: {},
      totalCost: 0,
      estimatedCostByModel: {},
      totalActivities: activities.length,
      activitiesWithTokens: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Aggregate each activity
    for (const activity of activities) {
      const input = activity.inputTokens || 0;
      const output = activity.outputTokens || 0;
      const total = activity.totalTokens || (input + output);
      const cost = activity.costTotal || 0;

      if (input === 0 && output === 0) continue;
      
      result.activitiesWithTokens++;
      result.totalInputTokens += input;
      result.totalOutputTokens += output;
      result.totalTokens += total;
      result.totalCost += cost;

      // By Agent
      if (activity.agentId) {
        if (!result.byAgent[activity.agentId]) {
          result.byAgent[activity.agentId] = { input: 0, output: 0, total: 0, activities: 0 };
        }
        result.byAgent[activity.agentId].input += input;
        result.byAgent[activity.agentId].output += output;
        result.byAgent[activity.agentId].total += total;
        result.byAgent[activity.agentId].activities++;
      }

      // By Ticket
      if (activity.ticketId) {
        if (!result.byTicket[activity.ticketId]) {
          result.byTicket[activity.ticketId] = { input: 0, output: 0, total: 0, activities: 0 };
        }
        result.byTicket[activity.ticketId].input += input;
        result.byTicket[activity.ticketId].output += output;
        result.byTicket[activity.ticketId].total += total;
        result.byTicket[activity.ticketId].activities++;
      }

      // By Model
      const model = activity.modelName || 'unknown';
      if (!result.byModel[model]) {
        result.byModel[model] = { input: 0, output: 0, total: 0, cost: 0 };
      }
      result.byModel[model].input += input;
      result.byModel[model].output += output;
      result.byModel[model].total += total;
      result.byModel[model].cost += cost;

      // By Day
      const day = activity.timestamp.toISOString().split('T')[0];
      if (!result.byDay[day]) {
        result.byDay[day] = { input: 0, output: 0, total: 0 };
      }
      result.byDay[day].input += input;
      result.byDay[day].output += output;
      result.byDay[day].total += total;
    }

    return result;
  } catch (error) {
    console.error('Error aggregating tokens:', error);
    throw error;
  }
}

/**
 * Get token stats for a specific agent
 */
export async function getAgentTokenStats(agentId: string): Promise<{
  totalInput: number;
  totalOutput: number;
  total: number;
  activities: number;
  averagePerActivity: number;
  cost: number;
} | null> {
  try {
    const activities = await prisma.activity.findMany({
      where: { agentId },
      select: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costTotal: true,
      },
    });

    if (activities.length === 0) return null;

    const stats = activities.reduce((acc, activity) => {
      const input = activity.inputTokens || 0;
      const output = activity.outputTokens || 0;
      const total = activity.totalTokens || (input + output);
      const cost = activity.costTotal || 0;

      acc.totalInput += input;
      acc.totalOutput += output;
      acc.total += total;
      acc.cost += cost;
      acc.activities++;

      return acc;
    }, { totalInput: 0, totalOutput: 0, total: 0, activities: 0, cost: 0 });

    return {
      ...stats,
      averagePerActivity: stats.activities > 0 ? Math.round(stats.total / stats.activities) : 0,
    };
  } catch (error) {
    console.error('Error getting agent token stats:', error);
    return null;
  }
}

/**
 * Get token stats for a specific ticket
 */
export async function getTicketTokenStats(ticketId: string): Promise<{
  totalInput: number;
  totalOutput: number;
  total: number;
  activities: number;
  agents: string[];
  cost: number;
} | null> {
  try {
    const activities = await prisma.activity.findMany({
      where: { ticketId },
      select: {
        agentId: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costTotal: true,
      },
    });

    if (activities.length === 0) return null;

    const stats = activities.reduce((acc, activity) => {
      const input = activity.inputTokens || 0;
      const output = activity.outputTokens || 0;
      const total = activity.totalTokens || (input + output);
      const cost = activity.costTotal || 0;

      acc.totalInput += input;
      acc.totalOutput += output;
      acc.total += total;
      acc.cost += cost;
      acc.activities++;
      
      if (activity.agentId && !acc.agents.includes(activity.agentId)) {
        acc.agents.push(activity.agentId);
      }

      return acc;
    }, { totalInput: 0, totalOutput: 0, total: 0, activities: 0, agents: [] as string[], cost: 0 });

    return stats;
  } catch (error) {
    console.error('Error getting ticket token stats:', error);
    return null;
  }
}

/**
 * Get real-time token usage for dashboard
 */
export async function getDashboardTokenStats(): Promise<{
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  todayInput: number;
  todayOutput: number;
  todayTotal: number;
  todayCost: number;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [allActivities, todayActivities] = await Promise.all([
      prisma.activity.findMany({
        select: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costTotal: true,
        },
      }),
      prisma.activity.findMany({
        where: {
          timestamp: {
            gte: today,
          },
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costTotal: true,
        },
      }),
    ]);

    const allStats = allActivities.reduce((acc, activity) => {
      acc.input += activity.inputTokens || 0;
      acc.output += activity.outputTokens || 0;
      acc.cost += activity.costTotal || 0;
      return acc;
    }, { input: 0, output: 0, cost: 0 });

    const todayStats = todayActivities.reduce((acc, activity) => {
      acc.input += activity.inputTokens || 0;
      acc.output += activity.outputTokens || 0;
      acc.cost += activity.costTotal || 0;
      return acc;
    }, { input: 0, output: 0, cost: 0 });

    return {
      totalInputTokens: allStats.input,
      totalOutputTokens: allStats.output,
      totalTokens: allStats.input + allStats.output,
      totalCost: allStats.cost,
      todayInput: todayStats.input,
      todayOutput: todayStats.output,
      todayTotal: todayStats.input + todayStats.output,
      todayCost: todayStats.cost,
    };
  } catch (error) {
    console.error('Error getting dashboard token stats:', error);
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      todayInput: 0,
      todayOutput: 0,
      todayTotal: 0,
      todayCost: 0,
    };
  }
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export default {
  aggregateAllTokens,
  getAgentTokenStats,
  getTicketTokenStats,
  getDashboardTokenStats,
  formatTokenCount,
};