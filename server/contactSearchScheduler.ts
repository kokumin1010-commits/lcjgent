/**
 * Contact Search Scheduler
 * 
 * Automatically searches for contact information (email, phone, website)
 * for Kalodata TikTok leads that don't have contact info yet.
 * 
 * Uses DuckDuckGo search to find shop contact details.
 * Updates leads via salesdash API (btobLeadProspector.updateLead).
 * 
 * Runs every 30 minutes, processes up to 20 leads per run to avoid rate limiting.
 */

import axios from "axios";

const SALESDASH_API = "https://salesdash.buzzdrop.co.jp/api/trpc";
const DDGS_SEARCH_URL = "https://html.duckduckgo.com/html/";
const BATCH_SIZE = 100; // leads per run
const SEARCH_DELAY_MS = 2000; // 2 seconds between searches to avoid rate limiting
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Progress tracking
let isRunning = false;
let lastRunStats = { processed: 0, updated: 0, errors: 0, lastRunAt: "" };

/**
 * Extract email addresses from text
 */
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Filter out common false positives
  return matches.filter(e => 
    !e.includes("example.com") &&
    !e.includes("sentry.io") &&
    !e.includes("wixpress.com") &&
    !e.includes("w3.org") &&
    !e.includes("duckduckgo.com") &&
    !e.includes("duck.com") &&
    !e.includes("noreply") &&
    !e.includes("no-reply") &&
    !e.includes("error-lite") &&
    !e.endsWith(".png") &&
    !e.endsWith(".jpg") &&
    !e.endsWith(".gif") &&
    e.length < 60
  );
}

/**
 * Extract phone numbers from text (Japanese format)
 */
function extractPhones(text: string): string[] {
  const phoneRegex = /(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|\+81[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|0\d{9,10})/g;
  const matches = text.match(phoneRegex) || [];
  return matches.filter(p => p.replace(/[-\s]/g, "").length >= 10);
}

/**
 * Extract website URLs from text
 */
function extractWebsites(text: string): string[] {
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/g;
  const matches = text.match(urlRegex) || [];
  // Filter out search engines, social media, and irrelevant URLs
  return matches.filter(u => 
    !u.includes("duckduckgo.com") &&
    !u.includes("google.com") &&
    !u.includes("bing.com") &&
    !u.includes("yahoo.co") &&
    !u.includes("facebook.com") &&
    !u.includes("twitter.com") &&
    !u.includes("instagram.com") &&
    !u.includes("tiktok.com") &&
    !u.includes("youtube.com") &&
    !u.includes("amazon.co") &&
    !u.includes("rakuten.co") &&
    !u.includes("wikipedia.org") &&
    !u.includes("w3.org") &&
    !u.includes("schema.org") &&
    !u.includes(".dtd")
  );
}

/**
 * Search DuckDuckGo for contact information
 */
async function searchDDGS(query: string): Promise<string> {
  try {
    const response = await axios.get(DDGS_SEARCH_URL, {
      params: { q: query },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
      timeout: 15000,
    });
    return response.data || "";
  } catch (error: any) {
    console.error(`[ContactSearch] DDGS search failed for "${query}":`, error.message);
    return "";
  }
}

/**
 * Search for contact info of a single lead
 */
async function searchContactForLead(lead: { id: number; companyName: string; shopName?: string }): Promise<{
  email?: string;
  phone?: string;
  website?: string;
} | null> {
  const name = lead.shopName || lead.companyName;
  if (!name) return null;

  // Search 1: Company name + contact
  const query1 = `${name} 問い合わせ メール 電話`;
  const html1 = await searchDDGS(query1);
  
  const emails = extractEmails(html1);
  const phones = extractPhones(html1);
  const websites = extractWebsites(html1);

  // If we didn't find much, try a second search
  if (emails.length === 0 && phones.length === 0 && websites.length === 0) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const query2 = `${name} 公式サイト 連絡先`;
    const html2 = await searchDDGS(query2);
    emails.push(...extractEmails(html2));
    phones.push(...extractPhones(html2));
    websites.push(...extractWebsites(html2));
  }

  if (emails.length === 0 && phones.length === 0 && websites.length === 0) {
    return null;
  }

  return {
    email: emails[0] || undefined,
    phone: phones[0] || undefined,
    website: websites[0] || undefined,
  };
}

/**
 * Get leads without contact info from salesdash
 */
async function getLeadsWithoutContact(): Promise<any[]> {
  try {
    const params = encodeURIComponent(JSON.stringify({
      json: { source: "kalodata_tiktok", hasEmail: false, limit: 5000 }
    }));
    const res = await axios.get(`${SALESDASH_API}/btobLeadProspector.getLeads?input=${params}`, {
      timeout: 30000,
    });
    const rows = res.data?.result?.data?.json?.rows || [];
    // Filter to only those without REAL contact info
    // TikTok/Kalodata URLs are not real contact websites, so ignore them
    const isTikTokOrKalodataUrl = (url: string | null | undefined) => {
      if (!url) return true; // no website = needs search
      return url.includes("tiktok.com") || url.includes("kalodata.com");
    };
    return rows.filter((r: any) => !r.email && !r.phone && isTikTokOrKalodataUrl(r.website));
  } catch (error: any) {
    console.error("[ContactSearch] Failed to get leads:", error.message);
    return [];
  }
}

/**
 * Update lead with contact info via salesdash API
 */
async function updateLeadContact(leadId: number, data: { email?: string; phone?: string; website?: string }): Promise<boolean> {
  try {
    const updateBody = { json: { id: leadId, data } };
    await axios.post(`${SALESDASH_API}/btobLeadProspector.updateLead`, updateBody, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
    return true;
  } catch (error: any) {
    console.error(`[ContactSearch] Failed to update lead ${leadId}:`, error.message);
    return false;
  }
}

/**
 * Main processing function - searches contacts for a batch of leads
 */
async function processContactSearchBatch(): Promise<void> {
  if (isRunning) {
    console.log("[ContactSearch] Already running, skipping...");
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  let processed = 0;
  let updated = 0;
  let errors = 0;

  try {
    console.log("[ContactSearch] Starting batch...");
    
    // Get leads without contact info
    const leads = await getLeadsWithoutContact();
    
    if (leads.length === 0) {
      console.log("[ContactSearch] No leads without contact info found. All done!");
      isRunning = false;
      return;
    }

    console.log(`[ContactSearch] Found ${leads.length} leads without contact info. Processing ${Math.min(BATCH_SIZE, leads.length)}...`);

    // Process batch
    const batch = leads.slice(0, BATCH_SIZE);
    
    for (const lead of batch) {
      try {
        const contact = await searchContactForLead({
          id: lead.id,
          companyName: lead.companyName,
          shopName: lead.shopName,
        });

        processed++;

        if (contact) {
          const success = await updateLeadContact(lead.id, contact);
          if (success) {
            updated++;
            console.log(`[ContactSearch] Updated lead ${lead.id} (${lead.companyName}): email=${contact.email || "N/A"}, phone=${contact.phone || "N/A"}, website=${contact.website || "N/A"}`);
          } else {
            errors++;
          }
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, SEARCH_DELAY_MS));
      } catch (err: any) {
        errors++;
        console.error(`[ContactSearch] Error processing lead ${lead.id}:`, err.message);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    lastRunStats = {
      processed,
      updated,
      errors,
      lastRunAt: new Date().toISOString(),
    };

    console.log(`[ContactSearch] Batch complete in ${elapsed}s. Processed: ${processed}, Updated: ${updated}, Errors: ${errors}. Remaining: ${leads.length - processed}`);
  } catch (error: any) {
    console.error("[ContactSearch] Fatal error:", error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Manual trigger - process a larger batch immediately
 */
export async function triggerContactSearch(batchSize?: number): Promise<{
  processed: number;
  updated: number;
  errors: number;
  remaining: number;
}> {
  if (isRunning) {
    return { processed: 0, updated: 0, errors: 0, remaining: -1 };
  }

  isRunning = true;
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let remaining = 0;

  try {
    const leads = await getLeadsWithoutContact();
    remaining = leads.length;

    if (leads.length === 0) {
      isRunning = false;
      return { processed: 0, updated: 0, errors: 0, remaining: 0 };
    }

    const size = batchSize || 50;
    const batch = leads.slice(0, size);

    for (const lead of batch) {
      try {
        const contact = await searchContactForLead({
          id: lead.id,
          companyName: lead.companyName,
          shopName: lead.shopName,
        });

        processed++;

        if (contact) {
          const success = await updateLeadContact(lead.id, contact);
          if (success) {
            updated++;
          } else {
            errors++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, SEARCH_DELAY_MS));
      } catch (err: any) {
        errors++;
      }
    }

    remaining = leads.length - processed;
    lastRunStats = { processed, updated, errors, lastRunAt: new Date().toISOString() };
  } catch (error: any) {
    console.error("[ContactSearch] Manual trigger error:", error.message);
  } finally {
    isRunning = false;
  }

  return { processed, updated, errors, remaining };
}

/**
 * Get current status
 */
export function getContactSearchStatus(): {
  isRunning: boolean;
  lastRunStats: typeof lastRunStats;
} {
  return { isRunning, lastRunStats };
}

// Start the scheduler
let intervalId: NodeJS.Timeout | null = null;

export function startContactSearchScheduler(): void {
  if (intervalId) {
    console.log("[ContactSearch] Scheduler already running");
    return;
  }

  console.log("[ContactSearch] Starting scheduler (every 5 minutes, 100 leads per batch)");

  // Run first batch after 30 seconds (let server warm up)
  setTimeout(() => {
    processContactSearchBatch();
  }, 30 * 1000);

  // Then run every 5 minutes
  intervalId = setInterval(processContactSearchBatch, CHECK_INTERVAL_MS);
}

export function stopContactSearchScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[ContactSearch] Scheduler stopped");
  }
}
