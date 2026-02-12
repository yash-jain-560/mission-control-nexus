/**
 * Cost Calculator Module
 * Tracks and calculates API costs based on token usage and model pricing
 * Updated with correct model pricing for accurate cost tracking
 */

// Model pricing per 1K tokens (in USD)
// Pricing as of 2024 - update as needed
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI Models
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  
  // Anthropic Models
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku': { input: 0.0008, output: 0.004 },
  
  // Google Models
  'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
  'gemini-1.5-flash': { input: 0.00035, output: 0.00105 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  
  // OpenClaw/Custom Models (estimated)
  'moonshot/kimi-k2.5': { input: 0.002, output: 0.008 },
  'kimi-k2.5': { input: 0.002, output: 0.008 },
  'local-llm': { input: 0, output: 0 }, // Local models have no API cost
};

// Default pricing for unknown models
const DEFAULT_PRICING = { input: 0.01, output: 0.03 };

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  pricing: { input: number; output: number };
}

export interface ActivityCost {
  activityId: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cost: CostBreakdown;
  timestamp: string;
}

/**
 * Get pricing for a model
 * Handles various model name formats and aliases
 */
export function getModelPricing(modelName: string): { input: number; output: number } {
  if (!modelName) return DEFAULT_PRICING;
  
  const normalizedName = modelName.toLowerCase().trim();
  
  // Try exact match first
  if (MODEL_PRICING[modelName]) {
    return MODEL_PRICING[modelName];
  }
  
  // Try normalized match
  if (MODEL_PRICING[normalizedName]) {
    return MODEL_PRICING[normalizedName];
  }

  // Try partial match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
      return pricing;
    }
  }

  // Handle specific patterns
  if (normalizedName.includes('gpt-4') && normalizedName.includes('mini')) {
    return MODEL_PRICING['gpt-4o-mini'];
  }
  if (normalizedName.includes('gpt-4o')) {
    return MODEL_PRICING['gpt-4o'];
  }
  if (normalizedName.includes('gpt-4')) {
    return MODEL_PRICING['gpt-4'];
  }
  if (normalizedName.includes('claude') && normalizedName.includes('opus')) {
    return MODEL_PRICING['claude-3-opus'];
  }
  if (normalizedName.includes('claude') && normalizedName.includes('haiku')) {
    return MODEL_PRICING['claude-3-haiku'];
  }
  if (normalizedName.includes('claude')) {
    return MODEL_PRICING['claude-3-sonnet'];
  }
  if (normalizedName.includes('gemini') && normalizedName.includes('flash')) {
    return MODEL_PRICING['gemini-1.5-flash'];
  }
  if (normalizedName.includes('gemini')) {
    return MODEL_PRICING['gemini-1.5-pro'];
  }
  if (normalizedName.includes('kimi')) {
    return MODEL_PRICING['kimi-k2.5'];
  }

  // Return default pricing
  return DEFAULT_PRICING;
}

/**
 * Calculate cost from token counts
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelName: string
): CostBreakdown {
  const pricing = getModelPricing(modelName);
  
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    currency: 'USD',
    modelName,
    inputTokens,
    outputTokens,
    pricing,
  };
}

/**
 * Calculate cost for an activity
 */
export function calculateActivityCost(
  activity: {
    id: string;
    inputTokens: number;
    outputTokens: number;
    timestamp: string | Date;
    metadata?: any;
  },
  modelName: string = 'gpt-4'
): ActivityCost {
  const cost = calculateCost(activity.inputTokens, activity.outputTokens, modelName);
  
  return {
    activityId: activity.id,
    modelName,
    inputTokens: activity.inputTokens,
    outputTokens: activity.outputTokens,
    cost,
    timestamp: typeof activity.timestamp === 'string' 
      ? activity.timestamp 
      : activity.timestamp.toISOString(),
  };
}

/**
 * Calculate total cost for multiple activities
 */
export function calculateTotalCost(activities: ActivityCost[]): CostBreakdown {
  return activities.reduce(
    (acc, activity) => ({
      inputCost: acc.inputCost + activity.cost.inputCost,
      outputCost: acc.outputCost + activity.cost.outputCost,
      totalCost: acc.totalCost + activity.cost.totalCost,
      currency: 'USD',
      modelName: 'aggregated',
      inputTokens: acc.inputTokens + activity.inputTokens,
      outputTokens: acc.outputTokens + activity.outputTokens,
      pricing: { input: 0, output: 0 },
    }),
    { 
      inputCost: 0, 
      outputCost: 0, 
      totalCost: 0, 
      currency: 'USD',
      modelName: 'aggregated',
      inputTokens: 0,
      outputTokens: 0,
      pricing: { input: 0, output: 0 },
    }
  );
}

/**
 * Format cost for display
 */
export function formatCost(cost: number, currency: string = 'USD'): string {
  if (cost === 0) {
    return '$0.00';
  }
  
  if (cost < 0.0001) {
    return '< $0.0001';
  }
  
  if (cost < 0.01) {
    return `$${cost.toFixed(6).replace(/\.?0+$/, '')}`;
  }
  
  if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  }
  
  return `$${cost.toFixed(2)}`;
}

/**
 * Format large costs (e.g., monthly totals)
 */
export function formatLargeCost(cost: number, currency: string = 'USD'): string {
  if (cost >= 1_000_000) {
    return `$${(cost / 1_000_000).toFixed(2)}M`;
  }
  if (cost >= 1_000) {
    return `$${(cost / 1_000).toFixed(2)}K`;
  }
  return formatCost(cost, currency);
}

/**
 * Estimate cost before making an API call
 */
export function estimateCost(
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  modelName: string
): CostBreakdown {
  return calculateCost(estimatedInputTokens, estimatedOutputTokens, modelName);
}

/**
 * Get cost tier for an activity
 */
export function getCostTier(cost: number): 'free' | 'low' | 'medium' | 'high' | 'very-high' {
  if (cost === 0) return 'free';
  if (cost < 0.01) return 'low';
  if (cost < 0.10) return 'medium';
  if (cost < 1.0) return 'high';
  return 'very-high';
}

/**
 * Get cost tier color for UI
 */
export function getCostTierColor(tier: ReturnType<typeof getCostTier>): string {
  switch (tier) {
    case 'free':
      return 'text-emerald-400';
    case 'low':
      return 'text-blue-400';
    case 'medium':
      return 'text-amber-400';
    case 'high':
      return 'text-orange-400';
    case 'very-high':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}

/**
 * Cost tracking for budget management
 */
export class CostTracker {
  private dailyBudget: number;
  private currentSpend: number = 0;
  private activities: ActivityCost[] = [];
  private modelBreakdown: Record<string, number> = {};

  constructor(dailyBudget: number = 10.0) {
    this.dailyBudget = dailyBudget;
  }

  track(activity: ActivityCost): void {
    this.activities.push(activity);
    this.currentSpend += activity.cost.totalCost;
    
    // Track by model
    if (!this.modelBreakdown[activity.modelName]) {
      this.modelBreakdown[activity.modelName] = 0;
    }
    this.modelBreakdown[activity.modelName] += activity.cost.totalCost;
  }

  getRemainingBudget(): number {
    return Math.max(0, this.dailyBudget - this.currentSpend);
  }

  getBudgetUtilization(): number {
    return (this.currentSpend / this.dailyBudget) * 100;
  }

  isBudgetExceeded(): boolean {
    return this.currentSpend >= this.dailyBudget;
  }

  getModelBreakdown(): Record<string, { cost: number; percentage: number }> {
    const result: Record<string, { cost: number; percentage: number }> = {};
    
    for (const [model, cost] of Object.entries(this.modelBreakdown)) {
      result[model] = {
        cost,
        percentage: this.currentSpend > 0 ? (cost / this.currentSpend) * 100 : 0,
      };
    }
    
    return result;
  }

  getSummary(): {
    totalSpend: number;
    budget: number;
    remaining: number;
    utilization: number;
    activityCount: number;
    modelBreakdown: Record<string, { cost: number; percentage: number }>;
  } {
    return {
      totalSpend: this.currentSpend,
      budget: this.dailyBudget,
      remaining: this.getRemainingBudget(),
      utilization: this.getBudgetUtilization(),
      activityCount: this.activities.length,
      modelBreakdown: this.getModelBreakdown(),
    };
  }

  reset(): void {
    this.currentSpend = 0;
    this.activities = [];
    this.modelBreakdown = {};
  }
}

export default {
  MODEL_PRICING,
  getModelPricing,
  calculateCost,
  calculateActivityCost,
  calculateTotalCost,
  formatCost,
  formatLargeCost,
  estimateCost,
  getCostTier,
  getCostTierColor,
  CostTracker,
};