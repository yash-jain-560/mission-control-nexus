/**
 * ModelRouter - Intelligent task routing between multiple AI models
 * 
 * Routes tasks to optimal models based on:
 * - Task complexity
 * - Cost efficiency
 * - Required capabilities
 * - Available quota
 */

type TaskType = 
  | 'orchestration'
  | 'implementation'
  | 'testing'
  | 'documentation'
  | 'design_review'
  | 'debugging'
  | 'planning';

type ModelChoice = 
  | 'gemini-2.0-flash'
  | 'gemini-2.0-pro'
  | 'claude-haiku-4-5'
  | 'claude-sonnet-4-5';

interface RoutingDecision {
  model: ModelChoice;
  reason: string;
  estimatedTokens: number;
  estimatedCost: number;
  fallback?: ModelChoice;
}

class ModelRouter {
  private routingRules: Map<TaskType, ModelChoice> = new Map([
    ['orchestration', 'gemini-2.0-flash'],
    ['implementation', 'claude-haiku-4-5'],
    ['testing', 'gemini-2.0-flash'],
    ['documentation', 'claude-haiku-4-5'],
    ['design_review', 'claude-sonnet-4-5'],
    ['debugging', 'claude-sonnet-4-5'],
    ['planning', 'gemini-2.0-flash'],
  ]);

  private tokenEstimates: Map<ModelChoice, number> = new Map([
    ['gemini-2.0-flash', 8000],      // Base tokens per task
    ['gemini-2.0-pro', 12000],
    ['claude-haiku-4-5', 20000],
    ['claude-sonnet-4-5', 60000],
  ]);

  private costPerMillion: Map<ModelChoice, number> = new Map([
    ['gemini-2.0-flash', 0],          // Free tier
    ['gemini-2.0-pro', 0],            // Free tier (lower quota)
    ['claude-haiku-4-5', 0.80],       // $0.80 per 1M input
    ['claude-sonnet-4-5', 3.00],      // $3.00 per 1M input
  ]);

  /**
   * Route a task to the optimal model
   */
  route(taskType: TaskType, context?: {
    complexity?: 'low' | 'medium' | 'high';
    urgency?: 'low' | 'medium' | 'high';
    tokenBudget?: number;
  }): RoutingDecision {
    const baseModel = this.routingRules.get(taskType);
    if (!baseModel) throw new Error(`Unknown task type: ${taskType}`);

    // Override routing based on context
    if (context?.complexity === 'high' && taskType !== 'design_review') {
      return this.createDecision('claude-sonnet-4-5', 
        'Complex task requires Sonnet reasoning', taskType);
    }

    if (context?.tokenBudget && context.tokenBudget < 15000) {
      return this.createDecision('gemini-2.0-flash',
        'Token budget requires free tier', taskType);
    }

    return this.createDecision(baseModel, 
      `Default routing for ${taskType}`, taskType);
  }

  /**
   * Batch route multiple tasks
   */
  routeBatch(tasks: { type: TaskType; context?: any }[]): RoutingDecision[] {
    return tasks.map(task => this.route(task.type, task.context));
  }

  /**
   * Create a routing decision with cost/token estimates
   */
  private createDecision(model: ModelChoice, reason: string, taskType: TaskType): RoutingDecision {
    const tokens = this.tokenEstimates.get(model) || 20000;
    const costPerM = this.costPerMillion.get(model) || 0;
    const cost = (tokens / 1000000) * costPerM;

    return {
      model,
      reason,
      estimatedTokens: tokens,
      estimatedCost: cost,
      fallback: this.getFallbackModel(model),
    };
  }

  /**
   * Get fallback model if primary is unavailable
   */
  private getFallbackModel(model: ModelChoice): ModelChoice {
    const fallbacks: Record<ModelChoice, ModelChoice> = {
      'gemini-2.0-flash': 'claude-haiku-4-5',
      'gemini-2.0-pro': 'gemini-2.0-flash',
      'claude-haiku-4-5': 'gemini-2.0-flash',
      'claude-sonnet-4-5': 'claude-haiku-4-5',
    };
    return fallbacks[model] || 'claude-haiku-4-5';
  }

  /**
   * Get daily cost estimate for a set of tasks
   */
  estimateDailyCost(taskCounts: Record<TaskType, number>): {
    total: number;
    breakdown: Record<ModelChoice, number>;
  } {
    const breakdown: Record<ModelChoice, number> = {};
    let total = 0;

    for (const [taskType, count] of Object.entries(taskCounts)) {
      const decision = this.route(taskType as TaskType);
      breakdown[decision.model] = (breakdown[decision.model] || 0) + (decision.estimatedCost * count);
      total += decision.estimatedCost * count;
    }

    return { total, breakdown };
  }
}

export { ModelRouter, TaskType, ModelChoice, RoutingDecision };
