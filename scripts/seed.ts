import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AGENTS = [
  { id: 'personal-agent', name: 'Personal Agent', type: 'personal', tokensAvailable: 2000000 },
  { id: 'work-agent', name: 'Work Agent', type: 'work', tokensAvailable: 3000000 },
  { id: 'orbit-main', name: 'Orbit', type: 'coordinator', tokensAvailable: 1500000 },
  { id: 'analyzer-1', name: 'Data Analyzer', type: 'worker', tokensAvailable: 1000000 },
  { id: 'monitor-prod', name: 'Prod Monitor', type: 'monitor', tokensAvailable: 1200000 },
];

const TICKETS = [
  {
    title: 'Implement multi-agent dashboard',
    description: 'Show all active agents with status indicators and token tracking',
    priority: 'CRITICAL',
    assigneeId: 'orbit-main',
    status: 'InProgress',
  },
  {
    title: 'Real-time activity feed',
    description: 'Pull actual session data and display agent activities',
    priority: 'HIGH',
    assigneeId: 'personal-agent',
    status: 'InProgress',
  },
  {
    title: 'Ticket management system',
    description: 'Create CRUD operations and drag-drop kanban interface',
    priority: 'HIGH',
    assigneeId: 'work-agent',
    status: 'InProgress',
  },
  {
    title: 'Status history tracking',
    description: 'Populate agentHistory table and display changes over time',
    priority: 'MEDIUM',
    assigneeId: 'analyzer-1',
    status: 'Backlog',
  },
  {
    title: 'API optimization',
    description: 'Improve response times for agent queries',
    priority: 'MEDIUM',
    assigneeId: 'monitor-prod',
    status: 'Backlog',
  },
  {
    title: 'Documentation update',
    description: 'Update API documentation for new endpoints',
    priority: 'LOW',
    assigneeId: null,
    status: 'Backlog',
  },
];

const ACTIVITY_TEMPLATES = [
  {
    type: 'agent_turn',
    description: (agentName: string) => `${agentName} received user query`,
    inputTokens: (Math.random() * 500) | 0,
    outputTokens: (Math.random() * 1000) | 0,
  },
  {
    type: 'tool_call',
    description: (agentName: string) => `${agentName} called web_search tool`,
    inputTokens: 100,
    outputTokens: (Math.random() * 800) | 0,
  },
  {
    type: 'tool_call',
    description: (agentName: string) => `${agentName} called exec tool for file operation`,
    inputTokens: 150,
    outputTokens: (Math.random() * 500) | 0,
  },
  {
    type: 'completion',
    description: (agentName: string) => `${agentName} completed task successfully`,
    inputTokens: 200,
    outputTokens: (Math.random() * 300) | 0,
  },
  {
    type: 'tool_call',
    description: (agentName: string) => `${agentName} called read tool to fetch document`,
    inputTokens: 80,
    outputTokens: (Math.random() * 1200) | 0,
  },
  {
    type: 'agent_turn',
    description: (agentName: string) => `${agentName} reasoning about next step`,
    inputTokens: (Math.random() * 300) | 0,
    outputTokens: (Math.random() * 400) | 0,
  },
];

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await prisma.activity.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.agentHistory.deleteMany();
    await prisma.heartbeat.deleteMany();
    await prisma.agent.deleteMany();

    // Create agents
    console.log('Creating agents...');
    for (const agent of AGENTS) {
      await prisma.agent.create({
        data: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: ['active', 'idle'].sort(() => Math.random() - 0.5)[0],
          tokensAvailable: agent.tokensAvailable,
          tokensUsed: Math.floor(Math.random() * 100000),
          lastHeartbeat: new Date(Date.now() - Math.random() * 60000),
          metadata: {
            model: ['claude-3-haiku', 'gpt-4', 'anthropic/claude-3-sonnet'][
              Math.floor(Math.random() * 3)
            ],
            version: '1.0.0',
          },
        },
      });
    }

    // Create agent history entries
    console.log('Creating agent history...');
    for (const agent of AGENTS) {
      const now = new Date();
      for (let i = 5; i > 0; i--) {
        await prisma.agentHistory.create({
          data: {
            agentId: agent.id,
            changeType: 'STATUS_CHANGE',
            fromValue: { status: 'idle' },
            toValue: { status: i % 2 === 0 ? 'active' : 'idle' },
            timestamp: new Date(now.getTime() - i * 300000),
            metadata: { reason: 'heartbeat update' },
          },
        });
      }
    }

    // Create heartbeat records
    console.log('Creating heartbeat records...');
    for (const agent of AGENTS) {
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        await prisma.heartbeat.create({
          data: {
            agentId: agent.id,
            status: ['active', 'idle', 'online'][Math.floor(Math.random() * 3)],
            timestamp: new Date(now.getTime() - i * 60000),
            tokensUsed: Math.floor(Math.random() * 50000),
            tokensAvailable: AGENTS.find(a => a.id === agent.id)?.tokensAvailable || 1000000,
            metadata: { health: 'good' },
          },
        });
      }
    }

    // Create tickets
    console.log('Creating tickets...');
    const createdTickets = [];
    for (const ticket of TICKETS) {
      const created = await prisma.ticket.create({
        data: {
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          assigneeId: ticket.assigneeId,
          reporterId: 'system',
          dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
          tags: [['feature', 'backend', 'ui', 'docs'][Math.floor(Math.random() * 4)]],
        },
      });
      createdTickets.push(created);
    }

    // Create activities
    console.log('Creating activities...');
    const now = new Date();
    for (const agent of AGENTS) {
      for (let i = 0; i < 15; i++) {
        const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
        const ticket = createdTickets[Math.floor(Math.random() * createdTickets.length)];
        
        await prisma.activity.create({
          data: {
            agentId: agent.id,
            activityType: template.type,
            description: template.description(agent.name),
            inputPrompt: `User query for ${template.type} operation`,
            output: `Result of ${template.type} operation`,
            toolName: template.type === 'tool_call' ? ['web_search', 'exec', 'read'][Math.floor(Math.random() * 3)] : null,
            inputTokens: template.inputTokens,
            outputTokens: template.outputTokens,
            timestamp: new Date(now.getTime() - (15 - i) * 180000),
            duration: Math.floor(Math.random() * 5000),
            ticketId: Math.random() > 0.5 ? ticket.id : null,
            metadata: { success: true },
          },
        });
      }
    }

    console.log('✅ Database seed completed successfully!');
    console.log(`  - Created ${AGENTS.length} agents`);
    console.log(`  - Created ${createdTickets.length} tickets`);
    console.log(`  - Created ${AGENTS.length * 15} activities`);
    console.log(`  - Created ${AGENTS.length * 5} agent history entries`);
    console.log(`  - Created ${AGENTS.length * 5} heartbeat records`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
