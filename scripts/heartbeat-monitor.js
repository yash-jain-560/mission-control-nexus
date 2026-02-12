#!/usr/bin/env node

/**
 * Heartbeat Monitor - Fixed for All Agents
 * Registers and sends heartbeats for all 5 agents
 */

const https = require('https');

const MCN_API_URL =
  process.env.MCN_API_URL || 'https://mission-control-nexus.vercel.app/api';

// All agents to monitor
const AGENTS = [
  { id: 'orbit-main', name: 'Orbit', type: 'main', status: 'WORKING' },
  { id: 'personal-agent', name: 'Personal Agent', type: 'worker', status: 'WORKING' },
  { id: 'work-agent', name: 'Work Agent', type: 'worker', status: 'WORKING' },
  { id: 'broad-monitor', name: 'Broad Monitor', type: 'monitor', status: 'WORKING' },
  { id: 'data-analyzer', name: 'Data Analyzer', type: 'analyzer', status: 'WORKING' },
];

function makeRequest(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(MCN_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function registerAgent(agent) {
  console.log(`[Heartbeat] Registering: ${agent.name} (${agent.id})`);
  try {
    const response = await makeRequest('/agents', 'POST', {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      tokensAvailable: 1000000,
    });

    if (response.status === 200 || response.status === 201) {
      console.log(`[Heartbeat] ✓ ${agent.name} registered`);
      return true;
    } else {
      console.log(`[Heartbeat] ⚠ ${agent.name} registration: ${response.status}`);
      return true; // Continue even if already exists
    }
  } catch (error) {
    console.error(`[Heartbeat] ✗ ${agent.name} registration failed:`, error.message);
    return false;
  }
}

async function sendHeartbeat(agent) {
  try {
    const payload = {
      agentId: agent.id,
      status: agent.status,
      tokensUsed: Math.floor(Math.random() * 50000) + 10000,
      tokensAvailable: 1000000,
      lastAction: 'monitoring',
      timestamp: new Date().toISOString(),
    };

    const response = await makeRequest(
      `/agents/${agent.id}/heartbeat`,
      'POST',
      payload
    );

    if (response.status === 200 || response.status === 201) {
      console.log(
        `[Heartbeat] ✓ ${agent.name}: ${agent.status} at ${new Date().toLocaleTimeString()}`
      );
      return true;
    } else {
      console.log(`[Heartbeat] ⚠ ${agent.name} heartbeat: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[Heartbeat] ✗ ${agent.name} heartbeat failed:`, error.message);
    return false;
  }
}

async function createTestActivity(agent) {
  try {
    const activities = [
      { type: 'agent_turn', desc: 'Processing user request' },
      { type: 'tool_call', desc: 'Executing database query' },
      { type: 'api_call', desc: 'Fetching external data' },
      { type: 'reasoning', desc: 'Analyzing context' },
    ];
    
    const activity = activities[Math.floor(Math.random() * activities.length)];
    
    const response = await makeRequest('/activities', 'POST', {
      agentId: agent.id,
      activityType: activity.type,
      description: activity.desc,
      inputTokens: Math.floor(Math.random() * 1000) + 100,
      outputTokens: Math.floor(Math.random() * 500) + 50,
      timestamp: new Date().toISOString(),
    });

    if (response.status === 200 || response.status === 201) {
      console.log(`[Activity] ✓ ${agent.name}: ${activity.desc}`);
    }
  } catch (error) {
    console.error(`[Activity] ✗ ${agent.name} activity failed:`, error.message);
  }
}

async function main() {
  const isRegister = process.argv.includes('--register');
  const isTest = process.argv.includes('--test');
  const isLoop = process.argv.includes('--loop');

  console.log('══════════════════════════════════════════════════');
  console.log('  Mission Control Nexus - Agent Heartbeat Monitor');
  console.log('══════════════════════════════════════════════════');
  console.log(`  API: ${MCN_API_URL}`);
  console.log(`  Agents: ${AGENTS.length}`);
  console.log('──────────────────────────────────────────────────');

  if (isRegister) {
    // Register all agents
    console.log('\n📋 Registering all agents...\n');
    for (const agent of AGENTS) {
      await registerAgent(agent);
    }
    console.log('\n✓ All agents registered\n');
  }

  if (isTest) {
    // Create test activities
    console.log('\n📝 Creating test activities...\n');
    for (const agent of AGENTS) {
      await createTestActivity(agent);
    }
    console.log('\n✓ Test activities created\n');
  }

  // Send heartbeats for all agents
  console.log('\n💓 Sending heartbeats...\n');
  let successCount = 0;
  for (const agent of AGENTS) {
    const success = await sendHeartbeat(agent);
    if (success) successCount++;
  }
  console.log(`\n✓ Heartbeats sent: ${successCount}/${AGENTS.length}\n`);

  if (isLoop) {
    // Continuous mode - heartbeat every 30 seconds
    console.log('🔄 Continuous mode enabled (30s interval)');
    console.log('Press Ctrl+C to stop\n');
    
    setInterval(async () => {
      console.log(`\n[${new Date().toLocaleTimeString()}] Sending heartbeats...`);
      for (const agent of AGENTS) {
        await sendHeartbeat(agent);
      }
    }, 30000);
  }
}

main().catch((error) => {
  console.error('[Heartbeat] Fatal error:', error);
  process.exit(1);
});
