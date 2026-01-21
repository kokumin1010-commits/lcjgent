/**
 * LINE Follow-up Scheduler
 * 
 * This module handles automated follow-up messages for LINE users.
 * It checks for pending follow-ups and sends messages based on configured conditions.
 */

import { getActiveLineFollowUps, updateLineFollowUpStatus, getLineUserByLineId, updateLineUserLastMessage } from "./db";
import { pushMessage } from "./line";

/**
 * Check and send LINE follow-up messages
 * This function should be called periodically (e.g., every hour)
 */
export async function checkAndSendLineFollowUps(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  console.log("[LINE Follow-up] Starting follow-up check...");
  
  const stats = {
    processed: 0,
    sent: 0,
    errors: 0,
  };
  
  try {
    // Get all active follow-ups
    const followUps = await getActiveLineFollowUps();
    console.log(`[LINE Follow-up] Found ${followUps.length} active follow-ups`);
    
    const now = new Date();
    
    for (const followUp of followUps) {
      stats.processed++;
      
      try {
        // Check if it's time to send
        if (followUp.nextScheduledAt && new Date(followUp.nextScheduledAt) > now) {
          console.log(`[LINE Follow-up] ID ${followUp.id}: Not yet scheduled (next: ${followUp.nextScheduledAt})`);
          continue;
        }
        
        // Check if max attempts reached
        if (followUp.currentAttempts >= followUp.maxAttempts) {
          console.log(`[LINE Follow-up] ID ${followUp.id}: Max attempts reached (${followUp.currentAttempts}/${followUp.maxAttempts})`);
          await updateLineFollowUpStatus(followUp.id, "completed");
          continue;
        }
        
        // Determine recipient
        const recipient = followUp.targetType === "user" 
          ? followUp.lineUserId 
          : followUp.lineGroupId;
        
        if (!recipient) {
          console.error(`[LINE Follow-up] ID ${followUp.id}: No recipient specified`);
          stats.errors++;
          continue;
        }
        
        // Check trigger condition
        if (followUp.triggerCondition === "no_reply") {
          // Check if user has replied since last follow-up
          const user = await getLineUserByLineId(recipient);
          if (user?.lastMessageAt && followUp.lastSentAt) {
            const lastMessage = new Date(user.lastMessageAt);
            const lastSent = new Date(followUp.lastSentAt);
            if (lastMessage > lastSent) {
              console.log(`[LINE Follow-up] ID ${followUp.id}: User has replied, marking as completed`);
              await updateLineFollowUpStatus(followUp.id, "completed");
              continue;
            }
          }
        }
        
        // Send the follow-up message
        console.log(`[LINE Follow-up] ID ${followUp.id}: Sending message to ${recipient}`);
        const success = await pushMessage(recipient, [
          { type: "text", text: followUp.messageTemplate },
        ]);
        
        if (success) {
          stats.sent++;
          
          // Calculate next scheduled time
          const nextScheduled = new Date();
          nextScheduled.setHours(nextScheduled.getHours() + followUp.delayHours);
          
          // Update follow-up status
          await updateLineFollowUpStatus(
            followUp.id,
            followUp.currentAttempts + 1 >= followUp.maxAttempts ? "completed" : "active",
            new Date(), // lastSentAt
            nextScheduled, // nextScheduledAt
            true // incrementAttempts
          );
          
          console.log(`[LINE Follow-up] ID ${followUp.id}: Message sent successfully`);
        } else {
          stats.errors++;
          console.error(`[LINE Follow-up] ID ${followUp.id}: Failed to send message`);
        }
        
      } catch (error) {
        stats.errors++;
        console.error(`[LINE Follow-up] ID ${followUp.id}: Error processing:`, error);
      }
    }
    
  } catch (error) {
    console.error("[LINE Follow-up] Error in scheduler:", error);
  }
  
  console.log(`[LINE Follow-up] Completed: processed=${stats.processed}, sent=${stats.sent}, errors=${stats.errors}`);
  return stats;
}

/**
 * Create a follow-up for a specific user based on inactivity
 * This can be called when a conversation ends without resolution
 */
export async function createInactivityFollowUp(
  lineUserId: string,
  messageTemplate: string,
  delayHours: number = 72,
  maxAttempts: number = 3,
  brandId?: number,
  createdBy?: number
) {
  const { createLineFollowUp } = await import("./db");
  
  const nextScheduled = new Date();
  nextScheduled.setHours(nextScheduled.getHours() + delayHours);
  
  return await createLineFollowUp({
    targetType: "user",
    lineUserId,
    triggerCondition: "no_reply",
    delayHours,
    maxAttempts,
    messageTemplate,
    brandId,
    createdBy,
    nextScheduledAt: nextScheduled,
  });
}

/**
 * Create a scheduled follow-up for a specific time
 */
export async function createScheduledFollowUp(
  lineUserId: string,
  messageTemplate: string,
  scheduledAt: Date,
  brandId?: number,
  createdBy?: number
) {
  const { createLineFollowUp } = await import("./db");
  
  return await createLineFollowUp({
    targetType: "user",
    lineUserId,
    triggerCondition: "scheduled",
    delayHours: 0,
    maxAttempts: 1,
    messageTemplate,
    brandId,
    createdBy,
    nextScheduledAt: scheduledAt,
  });
}
