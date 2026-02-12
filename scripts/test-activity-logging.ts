/**
 * Test Script for Activity Logging System
 * Verifies all components are working correctly
 */

import { prisma } from '../lib/prisma';
import { 
  logActivity, 
  logApiCall, 
  logToolCall, 
  logTicketOperation,
  ACTIVITY_TYPES,
  generateTraceId 
} from '../lib/activity-logger';
import { calculateTokens } from '../lib/token-counter';
import { calculateCost, formatCost } from '../lib/cost-calculator';

const TEST_AGENT_ID = 'test-agent-001';
const TEST_TICKET_ID = 'test-ticket-001';

async function runTests() {
  console.log('🧪 Starting Activity Logging System Tests\n');
  
  const results: { test: string; passed: boolean; error?: string }[] = [];

  // Test 1: Basic Activity Logging
  try {
    console.log('Test 1: Basic Activity Logging');
    const activity = await logActivity({
      agentId: TEST_AGENT_ID,
      activityType: ACTIVITY_TYPES.AGENT_TURN,
      description: 'Test agent turn activity',
      inputPrompt: 'Hello, this is a test prompt',
      output: 'This is a test response',
      modelName: 'gpt-4',
    });
    
    results.push({ 
      test: 'Basic Activity Logging', 
      passed: !!activity.id && activity.totalTokens > 0 
    });
    console.log(`✅ Activity created: ${activity.id}`);
    console.log(`   Tokens: ${activity.totalTokens} | Cost: ${formatCost(activity.cost?.totalCost || 0)}\n`);
  } catch (error) {
    results.push({ 
      test: 'Basic Activity Logging', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 2: Token Calculation
  try {
    console.log('Test 2: Token Calculation');
    const text = 'This is a test sentence with about fifteen tokens.';
    const tokens = calculateTokens(text);
    
    results.push({ 
      test: 'Token Calculation', 
      passed: tokens > 0 
    });
    console.log(`✅ Calculated ${tokens} tokens for text`);
    console.log(`   Text length: ${text.length} chars\n`);
  } catch (error) {
    results.push({ 
      test: 'Token Calculation', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 3: Cost Calculation
  try {
    console.log('Test 3: Cost Calculation');
    const cost = calculateCost(1000, 500, 'gpt-4');
    
    results.push({ 
      test: 'Cost Calculation', 
      passed: cost.totalCost > 0 
    });
    console.log(`✅ Cost calculated: ${formatCost(cost.totalCost)}`);
    console.log(`   Input: ${formatCost(cost.inputCost)} | Output: ${formatCost(cost.outputCost)}\n`);
  } catch (error) {
    results.push({ 
      test: 'Cost Calculation', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 4: API Call Logging
  try {
    console.log('Test 4: API Call Logging');
    const traceId = generateTraceId();
    const activity = await logApiCall(
      TEST_AGENT_ID,
      {
        url: '/api/test',
        method: 'POST',
        body: { test: true },
      },
      {
        statusCode: 200,
        body: { success: true },
      },
      150,
      { ticketId: TEST_TICKET_ID, traceId }
    );
    
    results.push({ 
      test: 'API Call Logging', 
      passed: activity.apiEndpoint === '/api/test' && activity.apiMethod === 'POST' 
    });
    console.log(`✅ API call logged: ${activity.id}`);
    console.log(`   Endpoint: ${activity.apiEndpoint} | Status: ${activity.apiStatusCode}\n`);
  } catch (error) {
    results.push({ 
      test: 'API Call Logging', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 5: Tool Call Logging
  try {
    console.log('Test 5: Tool Call Logging');
    const activity = await logToolCall(
      TEST_AGENT_ID,
      'file_read',
      { path: '/test/file.txt' },
      { content: 'test content', size: 100 },
      50,
      { ticketId: TEST_TICKET_ID }
    );
    
    results.push({ 
      test: 'Tool Call Logging', 
      passed: activity.toolName === 'file_read' 
    });
    console.log(`✅ Tool call logged: ${activity.id}`);
    console.log(`   Tool: ${activity.toolName}\n`);
  } catch (error) {
    results.push({ 
      test: 'Tool Call Logging', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 6: Ticket Operation Logging
  try {
    console.log('Test 6: Ticket Operation Logging');
    const activity = await logTicketOperation(
      TEST_AGENT_ID,
      'create',
      TEST_TICKET_ID,
      { title: 'Test Ticket', priority: 'MEDIUM' }
    );
    
    results.push({ 
      test: 'Ticket Operation Logging', 
      passed: activity.ticketId === TEST_TICKET_ID && activity.activityType === ACTIVITY_TYPES.CREATE_TICKET 
    });
    console.log(`✅ Ticket operation logged: ${activity.id}`);
    console.log(`   Ticket: ${activity.ticketId} | Type: ${activity.activityType}\n`);
  } catch (error) {
    results.push({ 
      test: 'Ticket Operation Logging', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 7: Activity Chain (Parent/Child)
  try {
    console.log('Test 7: Activity Chain (Parent/Child)');
    const traceId = generateTraceId();
    
    // Create parent activity
    const parentActivity = await logActivity({
      agentId: TEST_AGENT_ID,
      activityType: ACTIVITY_TYPES.AGENT_STARTED,
      description: 'Parent activity',
      traceId,
    });
    
    // Create child activity
    const childActivity = await logActivity({
      agentId: TEST_AGENT_ID,
      activityType: ACTIVITY_TYPES.TOOL_CALL,
      description: 'Child activity',
      parentActivityId: parentActivity.id,
      traceId,
    });
    
    results.push({ 
      test: 'Activity Chain', 
      passed: childActivity.parentActivityId === parentActivity.id 
    });
    console.log(`✅ Activity chain created`);
    console.log(`   Parent: ${parentActivity.id}`);
    console.log(`   Child: ${childActivity.id}\n`);
  } catch (error) {
    results.push({ 
      test: 'Activity Chain', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Test 8: Verify Database Schema
  try {
    console.log('Test 8: Database Schema Verification');
    const recentActivity = await prisma.activity.findFirst({
      orderBy: { timestamp: 'desc' },
    });
    
    const hasNewFields = recentActivity && 
      'totalTokens' in recentActivity &&
      'traceId' in recentActivity &&
      'costTotal' in recentActivity;
    
    results.push({ 
      test: 'Database Schema', 
      passed: !!hasNewFields 
    });
    console.log(`✅ Schema verification passed`);
    console.log(`   Has totalTokens: ${'totalTokens' in (recentActivity || {})}`);
    console.log(`   Has traceId: ${'traceId' in (recentActivity || {})}`);
    console.log(`   Has costTotal: ${'costTotal' in (recentActivity || {})}\n`);
  } catch (error) {
    results.push({ 
      test: 'Database Schema', 
      passed: false, 
      error: String(error) 
    });
    console.log(`❌ Failed: ${error}\n`);
  }

  // Summary
  console.log('─'.repeat(50));
  console.log('📊 TEST SUMMARY\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.test}`);
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    }
  });
  
  console.log('\n' + '─'.repeat(50));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️ ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});