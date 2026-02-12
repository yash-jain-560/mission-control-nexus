#!/usr/bin/env node

const https = require("https");

const MCN_API_URL =
  process.env.MCN_API_URL || "https://mission-control-nexus.vercel.app/api";
const AGENT_ID = process.env.AGENT_ID || "orbit-main";
const AGENT_NAME = process.env.AGENT_NAME || "Orbit";

function makeRequest(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "mission-control-nexus.vercel.app",
      path: `/api${path}`,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function registerAgent() {
  console.log(`[Heartbeat Monitor] Registering agent: ${AGENT_NAME}`);
  try {
    const response = await makeRequest("/agents", "POST",  {
      id: AGENT_ID,
      name: AGENT_NAME,
      type: "main",
      status: "active",
      tokensAvailable: 1000000,
    });

    if (response.status === 200 || response.status === 201) {
      console.log(`[Heartbeat Monitor] ✓ Agent registered: ${AGENT_ID}`);
      return true;
    } else {
      console.log(`[Heartbeat Monitor] Registration response: ${response.status}`);
      return true;
    }
  } catch (error) {
    console.error("[Heartbeat Monitor] Registration failed:", error.message);
    return false;
  }
}

async function sendHeartbeat() {
  try {
    const payload = {
      agentId: AGENT_ID,
      status: "active",
      tokensUsed: Math.floor(Math.random() * 50000),
      tokensAvailable: 1000000,
      lastAction: "monitoring",
      timestamp: new Date().toISOString(),
    };

    const response = await makeRequest(
      `/agents/${AGENT_ID}/heartbeat`,
      "POST",
      payload
    );

    if (response.status === 200 || response.status === 201) {
      console.log(
        `[Heartbeat Monitor] ✓ Heartbeat sent at ${new Date().toISOString()}`
      );
    } else {
      console.log(`[Heartbeat Monitor] Heartbeat response: ${response.status}`);
    }
  } catch (error) {
    console.error("[Heartbeat Monitor] Heartbeat failed:", error.message);
  }
}

async function main() {
  const isFirstRun = process.argv.includes("--register");

  if (isFirstRun) {
    const registered = await registerAgent();
    if (!registered) {
      process.exit(1);
    }
  }

  await sendHeartbeat();
}

main().catch((error) => {
  console.error("[Heartbeat Monitor] Fatal error:", error);
  process.exit(1);
});
