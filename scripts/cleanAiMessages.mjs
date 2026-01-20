import "dotenv/config";
import mysql from "mysql2/promise";

// Helper function to clean AI response from thinking process
function cleanAiResponse(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove character count patterns like "(22 characters)"
  cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
  
  // Remove numbered thinking steps with headers like "5. **Review and Finalize:**..."
  cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
  
  // Remove markdown headers like "**Review and Finalize:**" or "**Final Output Generation:**"
  cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
  
  // Remove lines starting with thinking process indicators
  cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
  
  // Remove parenthetical notes like (Self-correction: ...)
  cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
  cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
  cleaned = cleaned.replace(/\([^)]*Tuesday reference[^)]*\)/gi, "");
  cleaned = cleaned.replace(/\([^)]*friendly[^)]*\)/gi, "");
  
  // Remove semicolons followed by numbered steps
  cleaned = cleaned.replace(/;\s*\d+\.\s*/g, "");
  
  // Clean up multiple newlines and trim
  cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
  
  // If the cleaned result is too short, try to extract just the question
  if (cleaned.length < 5) {
    const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
    if (questionMatch && questionMatch.length > 0) {
      cleaned = questionMatch[questionMatch.length - 1].trim();
    }
  }
  
  return cleaned;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log("Fetching AI messages...");
    
    // Get all AI messages
    const [rows] = await connection.execute(
      "SELECT id, content FROM chat_report_messages WHERE role = 'ai'"
    );
    
    console.log(`Found ${rows.length} AI messages to process`);
    
    let updatedCount = 0;
    
    for (const row of rows) {
      const originalContent = row.content;
      const cleanedContent = cleanAiResponse(originalContent);
      
      // Only update if content changed
      if (originalContent !== cleanedContent) {
        await connection.execute(
          "UPDATE chat_report_messages SET content = ? WHERE id = ?",
          [cleanedContent, row.id]
        );
        updatedCount++;
        console.log(`Updated message ID ${row.id}:`);
        console.log(`  Before: ${originalContent.substring(0, 100)}...`);
        console.log(`  After: ${cleanedContent.substring(0, 100)}...`);
      }
    }
    
    console.log(`\nDone! Updated ${updatedCount} messages.`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

main();
