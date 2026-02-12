/**
 * OllamaClient - Local model inference via Ollama
 * 
 * Provides:
 * - Local model execution (zero cost)
 * - Automatic cloud fallback
 * - Streaming responses
 * - Error handling & retry logic
 */

import axios from 'axios';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface GenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  context?: number[];
  system?: string;
  template?: string;
  raw?: boolean;
  format?: string;
  options?: Record<string, unknown>;
}

interface ModelInfo {
  name: string;
  size: number;
  parameter_count?: number;
  quantization_level?: string;
}

class OllamaClient {
  private endpoint: string;
  private timeout: number;
  private retries: number;

  constructor(
    endpoint: string = process.env.OLLAMA_API_ENDPOINT || 'http://localhost:11434',
    timeout: number = parseInt(process.env.LOCAL_TIMEOUT_MS || '5000'),
    retries: number = 2
  ) {
    this.endpoint = endpoint;
    this.timeout = timeout;
    this.retries = retries;
  }

  /**
   * Health check - verify Ollama is running
   */
  async health(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, {
        timeout: 2000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get<{ models: any[] }>(
        `${this.endpoint}/api/tags`,
        { timeout: this.timeout }
      );
      return response.data.models.map((m: any) => ({
        name: m.name,
        size: m.size,
        parameter_count: m.details?.parameter_count,
        quantization_level: m.details?.quantization_level,
      }));
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  /**
   * Generate response from local model (with retry)
   */
  async generate(
    model: string,
    prompt: string,
    system?: string,
    options?: Record<string, unknown>
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const request: GenerateRequest = {
          model,
          prompt,
          stream: false,
          ...(system && { system }),
          ...(options && { options }),
        };

        const response = await axios.post<OllamaResponse>(
          `${this.endpoint}/api/generate`,
          request,
          { timeout: this.timeout }
        );

        return response.data.response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retries) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Ollama generation failed after ${this.retries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Stream response from local model
   */
  async *generateStream(
    model: string,
    prompt: string,
    system?: string,
    options?: Record<string, unknown>
  ): AsyncGenerator<string, void, unknown> {
    try {
      const request: GenerateRequest = {
        model,
        prompt,
        stream: true,
        ...(system && { system }),
        ...(options && { options }),
      };

      const response = await axios.post(
        `${this.endpoint}/api/generate`,
        request,
        {
          timeout: this.timeout * 2, // Double timeout for streaming
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((l: string) => l);
        for (const line of lines) {
          try {
            const parsed: OllamaResponse = JSON.parse(line);
            if (parsed.response) {
              yield parsed.response;
            }
            if (parsed.done) {
              return;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      throw new Error(`Ollama streaming failed: ${error}`);
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(model: string): Promise<ModelInfo | null> {
    const models = await this.listModels();
    return models.find((m) => m.name === model) || null;
  }

  /**
   * Check if specific model is available
   */
  async hasModel(model: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some((m) => m.name === model);
  }

  /**
   * Estimate token count (rough estimate)
   */
  estimateTokens(text: string): number {
    // Rule of thumb: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format cost estimate
   */
  formatCost(): string {
    return '$0.00 (local compute only)';
  }
}

export { OllamaClient, OllamaResponse, GenerateRequest, ModelInfo };
