/**
 * Agent Monitor - Auto-Heartbeat System
 * Automatically registers and sends heartbeats for all active agents
 */

import { OpenClawIntegration } from './openclaw-integration';

// Agent status types
export type AgentStatus = 'IDLE' | 'WORKING' | 'THINKING' | 'OFFLINE';

// Agent configuration
interface AgentConfig {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
}

// Default agents to monitor
const DEFAULT_AGENTS: AgentConfig[] = [
  { id: 'orbit-main', name: 'Orbit', type: 'main', status: 'WORKING' },
  { id: 'personal-agent', name: 'Personal Agent', type: 'worker', status: 'WORKING' },
  { id: 'work-agent', name: 'Work Agent', type: 'worker', status: 'WORKING' },
  { id: 'broad-monitor', name: 'Broad Monitor', type: 'monitor', status: 'WORKING' },
  { id: 'data-analyzer', name: 'Data Analyzer', type: 'analyzer', status: 'WORKING' },
];

/**
 * Agent Monitor - Singleton class for managing all agent heartbeats
 */
export class AgentMonitor {
  private static instance: AgentMonitor;
  private heartbeats: Map<string, NodeJS.Timeout> = new Map();
  private integrations: Map<string, OpenClawIntegration> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();

  static getInstance(): AgentMonitor {
    if (!AgentMonitor.instance) {
      AgentMonitor.instance = new AgentMonitor();
    }
    return AgentMonitor.instance;
  }

  /**
   * Register an agent and start automatic heartbeats
   */
  async registerAgent(
    agentId: string,
    agentName: string,
    type: string = 'worker',
    initialStatus: AgentStatus = 'IDLE'
  ): Promise<void> {
    // Store config
    this.agentConfigs.set(agentId, {
      id: agentId,
      name: agentName,
      type,
      status: initialStatus,
    });

    // Create integration instance
    const integration = new OpenClawIntegration(agentName);
    this.integrations.set(agentId, integration);

    try {
      // Register agent immediately
      await integration.registerAgent();
      console.log(`[MCN] ✓ ${agentName} registered (${agentId})`);

      // Send initial heartbeat
      await integration.sendHeartbeat(initialStatus.toLowerCase() as any, 'agent-registered');

      // Start automatic heartbeat every 30 seconds
      const interval = setInterval(async () => {
        try {
          const config = this.agentConfigs.get(agentId);
          const status = config?.status || 'IDLE';
          await integration.sendHeartbeat(status.toLowerCase() as any, 'auto-heartbeat');
        } catch (error) {
          console.error(`[MCN] Heartbeat failed for ${agentName}:`, error);
        }
      }, 30000);

      this.heartbeats.set(agentId, interval);
      console.log(`[MCN] ✓ ${agentName} heartbeat started (30s interval)`);
    } catch (error) {
      console.error(`[MCN] Failed to register ${agentName}:`, error);
    }
  }

  /**
   * Update agent status - sends immediate heartbeat with new status
   */
  async updateStatus(agentId: string, status: AgentStatus): Promise<void> {
    const config = this.agentConfigs.get(agentId);
    if (!config) {
      console.warn(`[MCN] Agent ${agentId} not found, cannot update status`);
      return;
    }

    // Update stored config
    config.status = status;
    this.agentConfigs.set(agentId, config);

    // Send immediate heartbeat
    const integration = this.integrations.get(agentId);
    if (integration) {
      try {
        await integration.sendHeartbeat(status.toLowerCase() as any, 'status-update');
        console.log(`[MCN] ${config.name} status updated: ${status}`);
      } catch (error) {
        console.error(`[MCN] Status update failed for ${config.name}:`, error);
      }
    }
  }

  /**
   * Unregister an agent and stop heartbeats
   */
  unregisterAgent(agentId: string): void {
    const interval = this.heartbeats.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.heartbeats.delete(agentId);
    }

    const integration = this.integrations.get(agentId);
    if (integration) {
      integration.stopHeartbeat();
      this.integrations.delete(agentId);
    }

    this.agentConfigs.delete(agentId);
    console.log(`[MCN] Agent ${agentId} unregistered`);
  }

  /**
   * Register all default agents
   */
  async registerAllDefaultAgents(): Promise<void> {
    console.log('[MCN] Registering all default agents...');
    
    for (const agent of DEFAULT_AGENTS) {
      await this.registerAgent(agent.id, agent.name, agent.type, agent.status);
    }

    console.log('[MCN] All agents registered successfully');
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentConfig[] {
    return Array.from(this.agentConfigs.values());
  }

  /**
   * Check if an agent is registered
   */
  isRegistered(agentId: string): boolean {
    return this.agentConfigs.has(agentId);
  }

  /**
   * Stop all heartbeats (cleanup)
   */
  stopAll(): void {
    console.log('[MCN] Stopping all agent heartbeats...');
    
    this.heartbeats.forEach((interval, agentId) => {
      clearInterval(interval);
      const integration = this.integrations.get(agentId);
      if (integration) {
        integration.stopHeartbeat();
      }
    });

    this.heartbeats.clear();
    this.integrations.clear();
    this.agentConfigs.clear();
    
    console.log('[MCN] All heartbeats stopped');
  }
}

// Export singleton instance
export const agentMonitor = AgentMonitor.getInstance();

// Convenience function to start monitoring all agents
export async function startAgentMonitoring(): Promise<void> {
  await agentMonitor.registerAllDefaultAgents();
}

// Convenience function to stop all monitoring
export function stopAgentMonitoring(): void {
  agentMonitor.stopAll();
}

export default agentMonitor;
