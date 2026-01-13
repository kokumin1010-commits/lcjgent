import { checkAndSendReminders } from "./server/reminderScheduler.ts";

console.log("Testing reminder email with completion link...");

try {
  const result = await checkAndSendReminders();
  console.log("Result:", JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log("\n✅ Reminder emails sent successfully!");
    console.log(`Total tasks: ${result.totalTasks}`);
    console.log(`Success: ${result.successCount}`);
    console.log(`Failed: ${result.failureCount}`);
  } else {
    console.error("\n❌ Failed to send reminders:", result.error);
  }
} catch (error) {
  console.error("Error:", error);
}
