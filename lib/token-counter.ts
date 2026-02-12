/**
 * Token Counter Module
 * Provides accurate token counting for text content
 * Uses tiktoken or falls back to approximation
 */

// Approximate tokens per character for different languages
const TOKENS_PER_CHAR = {
  english: 0.25,    // ~4 chars per token
  code: 0.2,        // ~5 chars per token (more symbols)
  mixed: 0.3,       // ~3.3 chars per token
};

// Tiktoken encoding cache
let encodingCache: any = null;

/**
 * Calculate token count for a given text
 * Uses tiktoken if available, falls back to character-based approximation
 */
export function calculateTokens(text: string, contentType: 'english' | 'code' | 'mixed' = 'mixed'): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Try to use tiktoken for accurate counting
  try {
    if (!encodingCache) {
      // Dynamic import to avoid bundling issues
      const { encoding_for_model } = require('tiktoken');
      encodingCache = encoding_for_model('gpt-4');
    }
    
    const tokens = encodingCache.encode(text);
    return tokens.length;
  } catch {
    // Fallback to approximation if tiktoken is not available
    return approximateTokens(text, contentType);
  }
}

/**
 * Approximate token count based on character count
 * Less accurate but doesn't require tiktoken
 */
export function approximateTokens(text: string, contentType: 'english' | 'code' | 'mixed' = 'mixed'): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const ratio = TOKENS_PER_CHAR[contentType] || TOKENS_PER_CHAR.mixed;
  return Math.ceil(text.length * ratio);
}

/**
 * Calculate tokens for structured content (objects, arrays)
 */
export function calculateTokensForObject(obj: any): number {
  if (obj === null || obj === undefined) {
    return 0;
  }

  const jsonString = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return calculateTokens(jsonString, 'code');
}

/**
 * Batch calculate tokens for multiple texts
 */
export function calculateTokensBatch(texts: string[]): number[] {
  return texts.map(text => calculateTokens(text));
}

/**
 * Get detailed token statistics
 */
export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheHits: number;
  estimatedCost?: number;
}

/**
 * Calculate token stats from input/output
 */
export function calculateTokenStats(
  input: string | object,
  output: string | object,
  cacheHits: number = 0
): TokenStats {
  const inputStr = typeof input === 'object' ? JSON.stringify(input) : input;
  const outputStr = typeof output === 'object' ? JSON.stringify(output) : output;

  const inputTokens = calculateTokens(inputStr);
  const outputTokens = calculateTokens(outputStr);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheHits,
  };
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

/**
 * Quick token estimate without tiktoken (for client-side use)
 */
export function quickTokenEstimate(text: string): number {
  // Simple approximation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

export default {
  calculateTokens,
  approximateTokens,
  calculateTokensForObject,
  calculateTokensBatch,
  calculateTokenStats,
  formatTokenCount,
  quickTokenEstimate,
};