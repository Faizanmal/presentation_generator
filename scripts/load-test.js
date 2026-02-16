/**
 * Load Testing Script for Scalability Validation
 * 
 * This script simulates high-concurrency scenarios to validate
 * the scalability improvements.
 * 
 * Requirements:
 * - npm install autocannon axios ws
 * 
 * Usage:
 * - node load-test.js --scenario=collaboration
 * - node load-test.js --scenario=ai-generation
 * - node load-test.js --scenario=block-edits
 * - node load-test.js --scenario=all
 */

const autocannon = require('autocannon');
const axios = require('axios');
const WebSocket = require('ws');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001/collaboration';

// Test configuration
const SCENARIOS = {
  // Test concurrent block edits
  blockEdits: {
    name: 'Concurrent Block Edits',
    duration: 60,
    connections: 100,
    pipelining: 10,
    url: `${API_URL}/blocks`,
    method: 'PATCH',
    body: JSON.stringify({
      content: { text: 'Updated text' },
      version: 1,
    }),
    headers: {
      'Content-Type': 'application/json',
      // Add auth token in production
    },
  },

  // Test AI generation queue
  aiGeneration: {
    name: 'AI Generation Load',
    duration: 120,
    connections: 50,
    pipelining: 5,
    url: `${API_URL}/ai/generate`,
    method: 'POST',
    body: JSON.stringify({
      topic: 'Load Test Presentation',
      tone: 'professional',
      length: 5,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  },

  // Test exports
  exports: {
    name: 'Concurrent Exports',
    duration: 60,
    connections: 20,
    pipelining: 1,
    url: `${API_URL}/export/pdf/project-123`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  },

  // Test project reads (cache effectiveness)
  projectReads: {
    name: 'Project Read Performance',
    duration: 60,
    connections: 200,
    pipelining: 20,
    url: `${API_URL}/projects/project-123`,
    method: 'GET',
  },
};

/**
 * Test WebSocket collaboration scalability
 */
async function testCollaboration() {
  console.log('\n🔌 Testing WebSocket Collaboration...\n');
  
  const connections = [];
  const numConnections = 1000;
  const messagesPerConnection = 100;
  
  let connectedCount = 0;
  let messagesSent = 0;
  let messagesReceived = 0;
  let errors = 0;

  const startTime = Date.now();

  return new Promise((resolve) => {
    // Create connections
    for (let i = 0; i < numConnections; i++) {
      try {
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
          connectedCount++;
          
          // Send test messages
          for (let j = 0; j < messagesPerConnection; j++) {
            setTimeout(() => {
              try {
                ws.send(JSON.stringify({
                  type: 'block:update',
                  data: {
                    blockId: `block-${i}`,
                    content: { text: `Message ${j}` },
                  },
                }));
                messagesSent++;
              } catch (err) {
                errors++;
              }
            }, Math.random() * 10000);
          }
        });

        ws.on('message', () => {
          messagesReceived++;
        });

        ws.on('error', () => {
          errors++;
        });

        connections.push(ws);
      } catch (err) {
        errors++;
      }
    }

    // Wait and collect results
    setTimeout(() => {
      const duration = (Date.now() - startTime) / 1000;
      
      console.log('📊 WebSocket Collaboration Results:');
      console.log(`   Connections: ${connectedCount}/${numConnections}`);
      console.log(`   Messages Sent: ${messagesSent}`);
      console.log(`   Messages Received: ${messagesReceived}`);
      console.log(`   Errors: ${errors}`);
      console.log(`   Duration: ${duration.toFixed(2)}s`);
      console.log(`   Messages/sec: ${(messagesSent / duration).toFixed(2)}`);
      console.log(`   Success Rate: ${((messagesSent - errors) / messagesSent * 100).toFixed(2)}%\n`);

      // Close connections
      connections.forEach(ws => {
        try {
          ws.close();
        } catch (err) {
          // Ignore
        }
      });

      resolve();
    }, 15000);
  });
}

/**
 * Test cache hit ratio
 */
async function testCachePerformance() {
  console.log('\n💾 Testing Cache Performance...\n');
  
  const projectId = 'test-project-123';
  const iterations = 1000;
  
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await axios.get(`${API_URL}/projects/${projectId}`);
      times.push(Date.now() - start);
    } catch (err) {
      // Ignore errors for this test
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  // First few requests should be slower (cache miss)
  const firstFew = times.slice(0, 10);
  const lastMany = times.slice(-100);
  
  const avgFirst = firstFew.reduce((a, b) => a + b, 0) / firstFew.length;
  const avgLast = lastMany.reduce((a, b) => a + b, 0) / lastMany.length;
  
  console.log('📊 Cache Performance Results:');
  console.log(`   Total Requests: ${iterations}`);
  console.log(`   Average Time: ${avgTime.toFixed(2)}ms`);
  console.log(`   Min Time: ${minTime}ms`);
  console.log(`   Max Time: ${maxTime}ms`);
  console.log(`   First 10 avg: ${avgFirst.toFixed(2)}ms (cache miss)`);
  console.log(`   Last 100 avg: ${avgLast.toFixed(2)}ms (cache hit)`);
  console.log(`   Cache Speedup: ${(avgFirst / avgLast).toFixed(2)}x\n`);
}

/**
 * Test rate limiting
 */
async function testRateLimiting() {
  console.log('\n⏱️  Testing Rate Limiting...\n');
  
  const endpoint = `${API_URL}/ai/generate`;
  const requests = 20; // Should hit rate limit at 10
  
  let allowed = 0;
  let blocked = 0;
  let retryAfter = null;

  for (let i = 0; i < requests; i++) {
    try {
      const response = await axios.post(endpoint, {
        topic: 'Test',
        length: 3,
      });
      
      if (response.status === 200) {
        allowed++;
      }
    } catch (err) {
      if (err.response?.status === 429) {
        blocked++;
        retryAfter = err.response.headers['retry-after'];
      }
    }
  }

  console.log('📊 Rate Limiting Results:');
  console.log(`   Total Requests: ${requests}`);
  console.log(`   Allowed: ${allowed}`);
  console.log(`   Blocked: ${blocked}`);
  console.log(`   Rate Limit Working: ${blocked > 0 ? '✅ Yes' : '❌ No'}`);
  console.log(`   Retry After: ${retryAfter || 'N/A'}s\n`);
}

/**
 * Run HTTP load test using autocannon
 */
function runHTTPLoadTest(scenario) {
  console.log(`\n🚀 Running: ${scenario.name}\n`);
  
  return new Promise((resolve) => {
    const instance = autocannon({
      ...scenario,
      requests: [
        {
          method: scenario.method,
          path: scenario.url.replace(API_URL, ''),
          body: scenario.body,
          headers: scenario.headers,
        },
      ],
    }, (err, result) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\n📊 Results:');
        console.log(`   Requests: ${result.requests.total}`);
        console.log(`   Throughput: ${result.throughput.mean} bytes/s`);
        console.log(`   Latency: ${result.latency.mean}ms (avg)`);
        console.log(`   Duration: ${result.duration}s`);
        console.log(`   Errors: ${result.errors}`);
        console.log(`   Timeouts: ${result.timeouts}`);
        console.log(`   Success Rate: ${((result.requests.total - result.errors - result.timeouts) / result.requests.total * 100).toFixed(2)}%\n`);
      }
      resolve();
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find(arg => arg.startsWith('--scenario='));
  const scenario = scenarioArg ? scenarioArg.split('=')[1] : 'all';

  console.log('🧪 Scalability Load Testing');
  console.log('============================\n');
  console.log(`Target: ${API_URL}`);
  console.log(`Scenario: ${scenario}\n`);

  try {
    if (scenario === 'all' || scenario === 'collaboration') {
      await testCollaboration();
    }

    if (scenario === 'all' || scenario === 'cache') {
      await testCachePerformance();
    }

    if (scenario === 'all' || scenario === 'rate-limit') {
      await testRateLimiting();
    }

    if (scenario === 'all' || scenario === 'block-edits') {
      await runHTTPLoadTest(SCENARIOS.blockEdits);
    }

    if (scenario === 'all' || scenario === 'ai-generation') {
      await runHTTPLoadTest(SCENARIOS.aiGeneration);
    }

    if (scenario === 'all' || scenario === 'exports') {
      await runHTTPLoadTest(SCENARIOS.exports);
    }

    if (scenario === 'all' || scenario === 'project-reads') {
      await runHTTPLoadTest(SCENARIOS.projectReads);
    }

    console.log('\n✅ Load testing completed!\n');
  } catch (err) {
    console.error('\n❌ Error during load testing:', err);
    process.exit(1);
  }
}

main();
