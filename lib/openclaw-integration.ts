/**
 * OpenClaw Integration Module
 * Connects OpenClaw agent sessions to Mission Control Nexus platform
 * Registers agent, sends heartbeats, creates/updates tickets in real-time
 */

import { v4 as uuidv4 } from "uuid";

interface AgentRegistration {
  id: string;
  name: string;
  type: string;
  status: "active" | "idle" | "offline";
  lastHeartbeat: string;
  tokensUsed: number;
  tokensAvailable: number;
}

interface HeartbeatPayload {
  agentId: string;
  status: "active" | "idle" | "offline";
  tokensUsed: number;
  tokensAvailable: number;
  messageCount?: number;
  lastAction?: string;
  timestamp: string;
}

interface TicketPayload {
  title: string;
  description?: string;
  status: "backlog" | "assigned" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
}

const MCN_API_URL =
  process.env.MCN_API_URL || "https://mission-control-nexus.vercel.app/api";

export class OpenClawIntegration {
  private agentId: string;
  private agentName: string;
  private heartbeatInterval: NodeJS.Timer | null = null;
  private sessionStartTime: number;
  private messageCount: number = 0;
  private tokensUsed: number = 0;

  constructor(agentName: string = "Orbit") {
    this.agentName = agentName;
    this.agentId = uuidv4().substring(0, 12); // Short ID for readability
    this.sessionStartTime = Date.now();
  }

  /**
   * Register agent with Mission Control Nexus
   */
  async registerAgent(): Promise<AgentRegistration> {
    try {
      const response = await fetch(`${MCN_API_URL}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: this.agentId,
          name: this.agentName,
          type: "main",
          status: "active",
          tokensAvailable: 1000000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register agent: ${response.statusText}`);
      }

      const data = (await response.json()) as AgentRegistration;
      console.log(`[MCN] Agent registered: ${this.agentName} (${this.agentId})`);
      return data;
    } catch (error) {
      console.error("[MCN] Registration failed:", error);
      throw error;
    }
  }

  /**
   * Send heartbeat to Mission Control Nexus
   */
  async sendHeartbeat(
    status: "active" | "idle" | "offline" = "active",
    lastAction?: string
  ): Promise<void> {
    try {
      const payload: HeartbeatPayload = {
        agentId: this.agentId,
        status,
        tokensUsed: this.tokensUsed,
        tokensAvailable: 1000000,
        messageCount: this.messageCount,
        lastAction: lastAction || "monitoring",
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(
        `${MCN_API_URL}/agents/${this.agentId}/heartbeat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.statusText}`);
      }

      console.log(`[MCN] Heartbeat sent: ${status}`);
    } catch (error) {
      console.error("[MCN] Heartbeat failed:", error);
    }
  }

  /**
   * Start automatic heartbeat (every 30 seconds)
   */
  startHeartbeat(): void {
    this.sendHeartbeat("active", "system-monitoring").catch(console.error);

    this.heartbeatInterval = setInterval(() => {
      const uptime = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      const status =
        uptime > 3600 ? "idle" : uptime > 600 ? "idle" : "active";
      this.sendHeartbeat(status, `uptime: ${uptime}s`).catch(console.error);
    }, 30000);
  }

  /**
   * Stop automatic heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval as any);
      this.heartbeatInterval = null;
    }
    this.sendHeartbeat("offline", "session-ended").catch(console.error);
  }

  /**
   * Create a ticket on Mission Control Nexus
   */
  async createTicket(
    title: string,
    description?: string,
    priority: "low" | "medium" | "high" = "medium"
  ): Promise<{ id: string }> {
    try {
      const response = await fetch(`${MCN_API_URL}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || `Created by ${this.agentName}`,
          status: "backlog",
          priority,
          assignedTo: this.agentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create ticket: ${response.statusText}`);
      }

      const ticket = (await response.json()) as { id: string };
      console.log(`[MCN] Ticket created: ${ticket.id}`);
      return ticket;
    } catch (error) {
      console.error("[MCN] Ticket creation failed:", error);
      throw error;
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: "backlog" | "assigned" | "in_progress" | "review" | "done"
  ): Promise<void> {
    try {
      const response = await fetch(`${MCN_API_URL}/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ticket: ${response.statusText}`);
      }

      console.log(`[MCN] Ticket ${ticketId} updated to: ${status}`);
    } catch (error) {
      console.error("[MCN] Ticket update failed:", error);
    }
  }

  /**
   * Increment message count (call after each turn)
   */
  incrementMessageCount(): void {
    this.messageCount++;
  }

  /**
   * Update token usage
   */
  updateTokens(used: number, available?: number): void {
    this.tokensUsed = used;
  }

  /**
   * Get agent info
   */
  getAgentInfo(): { id: string; name: string; messageCount: number } {
    return {
      id: this.agentId,
      name: this.agentName,
      messageCount: this.messageCount,
    };
  }
}

// Export singleton instance for easy reuse
let integrationInstance: OpenClawIntegration | null = null;

export function getIntegration(agentName?: string): OpenClawIntegration {
  if (!integrationInstance) {
    integrationInstance = new OpenClawIntegration(agentName);
  }
  return integrationInstance;
}

export async function initializeIntegration(
  agentName?: string
): Promise<OpenClawIntegration> {
  const integration = getIntegration(agentName);
  await integration.registerAgent();
  integration.startHeartbeat();
  return integration;
}
