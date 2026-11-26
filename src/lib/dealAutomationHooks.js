/**
 * Deal Automation Hooks (Stubs for Phase 4 & Phase 5)
 * 
 * These functions are called by the pipeline action handlers immediately after
 * a Firestore transaction successfully commits. They do not block the UI or
 * main pipeline flow.
 */

export async function onDealStageChanged({ deal, fromStageId, toStageId, changedByAgentId }) {
  // Phase 4 TODO: Implement task auto-creation logic based on stage entry
}

export async function onDealWon({ deal }) {
  // Phase 5 TODO: Implement commission record creation logic
}
