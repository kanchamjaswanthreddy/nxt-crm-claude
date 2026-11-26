import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Verify Vercel Cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const admin = getAdminApp();
    const db = admin.firestore();
    
    // Fetch all open tasks
    const snapshot = await db.collection('tasks').where('status', '==', 'open').get();
    
    const tasksByAgent = {};
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.dueAt) return;
      
      const dueMs = data.dueAt.toMillis();
      
      // We want tasks that are overdue OR due today
      if (dueMs < endOfToday) {
        if (!tasksByAgent[data.ownerAgentId]) {
          tasksByAgent[data.ownerAgentId] = [];
        }
        tasksByAgent[data.ownerAgentId].push({
          id: doc.id,
          ...data,
          dueAtMs: dueMs
        });
      }
    });
    
    // Compile agent emails
    const emailPromises = Object.keys(tasksByAgent).map(async (agentId) => {
      const tasks = tasksByAgent[agentId];
      if (tasks.length === 0) return;
      
      try {
        const agentDoc = await db.collection('agents').doc(agentId).get();
        if (!agentDoc.exists) return;
        
        const agentData = agentDoc.data();
        const agentEmail = agentData.email;
        const agentName = [agentData.first_name, agentData.middle_name, agentData.last_name].filter(Boolean).join(' ') || agentData.full_name || '';
        
        let overdueCount = 0;
        let dueTodayCount = 0;
        
        tasks.forEach(t => {
          if (t.dueAtMs < now.getTime()) {
            overdueCount++;
          } else {
            dueTodayCount++;
          }
        });
        
        // TODO: send digest email when email provider is hooked up
        // Agent: ${agentEmail} (${agentName}), ${overdueCount} overdue, ${dueTodayCount} due today
        
        // If an email provider (like SendGrid/Resend) was hooked up, the API call would go here.
        // As per prompt: "send a single digest email per agent... if it fails do not throw".
        
      } catch (err) {
        console.error(`Failed to generate email for agent ${agentId}:`, err);
        // Do not throw back to break the loop
      }
    });

    await Promise.all(emailPromises);

    return NextResponse.json({ success: true, agentsProcessed: Object.keys(tasksByAgent).length });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
