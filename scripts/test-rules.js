const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');

async function runTests() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'nxt-crm-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  console.log("Running Security Rules Tests...");

  // 1. Unauthenticated request rejected
  const unauthed = testEnv.unauthenticatedContext();
  await assertFails(unauthed.firestore().collection('leads').get());
  console.log("✅ Unauthenticated read rejected");

  // 2. Unauthenticated create web_form lead allowed
  await assertSucceeds(unauthed.firestore().collection('leads').add({
    source: 'web_form',
    ownerAgentId: null,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@test.com'
  }));
  console.log("✅ Public web form lead allowed");

  // 3. Agent Scope Bounds
  const agentId = 'agent1';
  const authedAgent = testEnv.authenticatedContext(agentId, {
    uid: agentId
  });

  // Setup mock agent data (simulate a backend write for setup)
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('agents').doc(agentId).set({
      agency_id: 'agency1',
      hierarchyPath: 'agency1/nodeA/agent1',
      role: 'agent'
    });
    
    await db.collection('leads').doc('leadOutsideScope').set({
      agencyId: 'agency1',
      ownerAgentId: 'agent2', // outside scope
      ownerHierarchyPath: 'agency1/nodeB/agent2'
    });

    await db.collection('AgentMetricsSummary').doc('summary1').set({
      agencyId: 'agency1',
      agentId: 'agent1'
    });
  });

  // Attempt to read out of scope lead
  await assertFails(authedAgent.firestore().collection('leads').doc('leadOutsideScope').get());
  console.log("✅ Agent cannot read out of scope lead");

  // Attempt to write to metrics
  await assertFails(authedAgent.firestore().collection('AgentMetricsSummary').doc('summary1').update({ dealsWonCount: 99 }));
  console.log("✅ Client writes to AgentMetricsSummary rejected");

  console.log("All security rules tests passed!");
  process.exit(0);
}

runTests().catch(console.error);
