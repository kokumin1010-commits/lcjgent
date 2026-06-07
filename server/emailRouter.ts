/**
 * メールルーター (Email Router)
 * 独立ファイル: server/emailRouter.ts
 * 
 * 機能:
 * - IMAP経由でメール受信一覧取得
 * - SMTP経由でメール送信
 * - メール本文取得
 * - 招商管理ページからのメール操作
 * 
 * 使用アカウント: lcj.inquiry@livecommercejapan.jp (Alibaba Cloud Enterprise Mail)
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import nodemailer from "nodemailer";
import { getUnrepliedCount, getUnrepliedEmails, markReplyReceivedByEmail, markRepliedByUs } from "./db";

// ===== IMAP接続ヘルパー =====
async function getImapClient() {
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: ENV.emailPopHost.replace("pop.", "imap."), // pop.qiye.aliyun.com → imap.qiye.aliyun.com
    port: 993,
    secure: true,
    auth: {
      user: ENV.emailUser,
      pass: ENV.emailPassword,
    },
    logger: false,
  });
  return client;
}

// ===== SMTP送信ヘルパー =====
function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: ENV.emailSmtpHost,
    port: 465,
    secure: true,
    auth: {
      user: ENV.emailUser,
      pass: ENV.emailPassword,
    },
  });
}

// ===== メールパーサーヘルパー =====
async function parseMessage(source: any) {
  const { simpleParser } = await import("mailparser");
  return simpleParser(source);
}

export const emailRouter = router({
  // ===== 1. 受信メール一覧取得 =====
  listInbox: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      folder: z.string().default("INBOX"),
    }))
    .query(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }

      const client = await getImapClient();
      try {
        await client.connect();
        const lock = await client.getMailboxLock(input.folder);
        try {
          const mailbox = client.mailbox;
          const total = mailbox?.exists ?? 0;
          
          if (total === 0) {
            return { emails: [], total: 0, page: input.page, pageSize: input.pageSize };
          }

          // 最新メールから取得（降順）
          const start = Math.max(1, total - (input.page * input.pageSize) + 1);
          const end = Math.max(1, total - ((input.page - 1) * input.pageSize));
          
          const emails: any[] = [];
          
          // IMAP SEQUENCEで取得（新しい順）
          const range = `${start}:${end}`;
          
          for await (const message of client.fetch(range, {
            envelope: true,
            flags: true,
            bodyStructure: true,
            uid: true,
          })) {
            const envelope = message.envelope;
            emails.push({
              uid: message.uid,
              seq: message.seq,
              subject: envelope.subject || "(件名なし)",
              from: envelope.from?.[0] ? {
                name: envelope.from[0].name || "",
                address: envelope.from[0].address || "",
              } : { name: "", address: "" },
              to: (envelope.to || []).map((t: any) => ({
                name: t.name || "",
                address: t.address || "",
              })),
              date: envelope.date ? new Date(envelope.date).toISOString() : null,
              flags: Array.from(message.flags || []),
              seen: message.flags?.has("\\Seen") || false,
              hasAttachments: !!(message.bodyStructure as any)?.childNodes?.some(
                (n: any) => n.disposition === "attachment"
              ),
            });
          }

          // 新しい順にソート
          emails.sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db = b.date ? new Date(b.date).getTime() : 0;
            return db - da;
          });

          return {
            emails,
            total,
            page: input.page,
            pageSize: input.pageSize,
          };
        } finally {
          lock.release();
        }
      } catch (err: any) {
        console.error("[Email Router] IMAP fetch error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "メール取得に失敗しました: " + (err.message || "不明なエラー"),
        });
      } finally {
        try { await client.logout(); } catch {}
      }
    }),

  // ===== 2. メール本文取得 =====
  getMessage: protectedProcedure
    .input(z.object({
      uid: z.number(),
      folder: z.string().default("INBOX"),
    }))
    .query(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }

      const client = await getImapClient();
      try {
        await client.connect();
        const lock = await client.getMailboxLock(input.folder);
        try {
          // メッセージソースを取得
          const message = await client.fetchOne(String(input.uid), {
            source: true,
            uid: true,
          }, { uid: true });

          if (!message?.source) {
            throw new TRPCError({ code: "NOT_FOUND", message: "メールが見つかりません" });
          }

          // メールをパース
          const parsed = await parseMessage(message.source);

          // 既読にマーク
          await client.messageFlagsAdd(String(input.uid), ["\\Seen"], { uid: true });

          return {
            uid: input.uid,
            messageId: parsed.messageId || null,
            inReplyTo: parsed.inReplyTo || null,
            references: (parsed.references ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : String(parsed.references)) : null),
            subject: parsed.subject || "(件名なし)",
            from: parsed.from?.value?.[0] ? {
              name: parsed.from.value[0].name || "",
              address: parsed.from.value[0].address || "",
            } : { name: "", address: "" },
            to: (parsed.to as any)?.value?.map((t: any) => ({
              name: t.name || "",
              address: t.address || "",
            })) || [],
            cc: (parsed.cc as any)?.value?.map((t: any) => ({
              name: t.name || "",
              address: t.address || "",
            })) || [],
            date: parsed.date?.toISOString() || null,
            html: parsed.html || null,
            text: parsed.text || "",
            attachments: (parsed.attachments || []).map((att) => ({
              filename: att.filename || "attachment",
              contentType: att.contentType || "application/octet-stream",
              size: att.size || 0,
              contentId: att.cid || null,
              content: att.content ? Buffer.from(att.content).toString("base64") : null,
            })),
          };
        } finally {
          lock.release();
        }
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        console.error("[Email Router] getMessage error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "メール取得に失敗しました: " + (err.message || "不明なエラー"),
        });
      } finally {
        try { await client.logout(); } catch {}
      }
    }),

  // ===== 3. メール送信 =====
  sendEmail: protectedProcedure
    .input(z.object({
      to: z.array(z.string().email()),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      subject: z.string().min(1, "件名は必須です"),
      text: z.string().optional(),
      html: z.string().optional(),
      inReplyTo: z.string().optional(),
      references: z.string().optional(),
      attachments: z.array(z.object({
        filename: z.string(),
        contentType: z.string(),
        content: z.string(), // Base64
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }

      try {
        const transporter = createSmtpTransporter();
        const mailOptions: any = {
          from: `"LCJ Inquiry" <${ENV.emailUser}>`,
          to: input.to.join(", "),
          subject: input.subject,
        };

        if (input.cc?.length) mailOptions.cc = input.cc.join(", ");
        if (input.bcc?.length) mailOptions.bcc = input.bcc.join(", ");
        if (input.html) mailOptions.html = input.html;
        if (input.text) mailOptions.text = input.text;
        if (input.inReplyTo) mailOptions.inReplyTo = input.inReplyTo;
        if (input.references) mailOptions.references = input.references;
        if (input.attachments?.length) {
          mailOptions.attachments = input.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            content: Buffer.from(att.content, "base64"),
          }));
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("[Email Router] Email sent:", info.messageId);

        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        console.error("[Email Router] Send error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "メール送信に失敗しました: " + (err.message || "不明なエラー"),
        });
      }
    }),

  // ===== 4. 送信済みメール一覧 =====
  listSent: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      // IMAPの送信済み + salesEmailLogsのバッチ送信を統合表示
      const allEmails: any[] = [];
      let imapTotal = 0;

      // 1. IMAPの送信済みを取得
      if (ENV.emailUser && ENV.emailPassword) {
        const client = await getImapClient();
        try {
          await client.connect();
          const sentFolders = ["Sent Messages", "Sent", "已发送", "INBOX.Sent"];
          let sentFolder = "Sent Messages";
          const mailboxes = await client.list();
          for (const mb of mailboxes) {
            const path = mb.path || "";
            if (sentFolders.some(f => path.toLowerCase() === f.toLowerCase())) {
              sentFolder = path;
              break;
            }
          }
          const lock = await client.getMailboxLock(sentFolder);
          try {
            const mailbox = client.mailbox;
            imapTotal = mailbox?.exists ?? 0;
            if (imapTotal > 0) {
              // 最新200件まで取得してDB側と統合ソート
              const fetchCount = Math.min(imapTotal, 200);
              const start = Math.max(1, imapTotal - fetchCount + 1);
              const range = `${start}:${imapTotal}`;
              for await (const message of client.fetch(range, {
                envelope: true,
                flags: true,
                uid: true,
              })) {
                const envelope = message.envelope;
                allEmails.push({
                  uid: message.uid,
                  seq: message.seq,
                  source: "imap",
                  subject: envelope.subject || "(件名なし)",
                  from: envelope.from?.[0] ? {
                    name: envelope.from[0].name || "",
                    address: envelope.from[0].address || "",
                  } : { name: "", address: "" },
                  to: (envelope.to || []).map((t: any) => ({
                    name: t.name || "",
                    address: t.address || "",
                  })),
                  date: envelope.date ? new Date(envelope.date).toISOString() : null,
                  flags: Array.from(message.flags || []),
                  status: "sent",
                });
              }
            }
          } finally {
            lock.release();
          }
        } catch (err: any) {
          console.error("[Email Router] listSent IMAP error:", err.message);
          // IMAPエラーでもDB側は表示する
        } finally {
          try { await client.logout(); } catch {}
        }
      }

      // 2. salesEmailLogsからバッチ送信分を取得
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        const { salesEmailLogs } = await import("../drizzle/schema");
        const { desc, sql } = await import("drizzle-orm");
        const sesEmails = await db
          .select()
          .from(salesEmailLogs)
          .orderBy(desc(salesEmailLogs.sentAt))
          .limit(500);
        for (const log of sesEmails) {
          allEmails.push({
            uid: `ses-${log.id}`,
            seq: 0,
            source: "ses",
            subject: log.subject || "(件名なし)",
            from: {
              name: "株式会社ライブコマースジャパン",
              address: ENV.awsSesFromEmail || "info@livecommercejapan.jp",
            },
            to: [{
              name: log.toName || "",
              address: log.toEmail || "",
            }],
            date: log.sentAt ? new Date(log.sentAt).toISOString() : null,
            flags: [],
            status: log.status || "sent",
            sendType: log.sendType,
            toCompany: log.toCompany,
            attachPdf: log.attachPdf,
          });
        }
      } catch (dbErr: any) {
        console.error("[Email Router] listSent DB error:", dbErr.message);
      }

      // 3. 日付降順でソート
      allEmails.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db2 = b.date ? new Date(b.date).getTime() : 0;
        return db2 - da;
      });

      // 4. ページネーション
      const total = allEmails.length;
      const startIdx = (input.page - 1) * input.pageSize;
      const pageEmails = allEmails.slice(startIdx, startIdx + input.pageSize);

      return { emails: pageEmails, total, page: input.page, pageSize: input.pageSize };
    }),

  // ===== 5. メールフォルダ一覧 =====
  listFolders: protectedProcedure.query(async () => {
    if (!ENV.emailUser || !ENV.emailPassword) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
    }

    const client = await getImapClient();
    try {
      await client.connect();
      const mailboxes = await client.list();
      return mailboxes.map((mb: any) => ({
        path: mb.path,
        name: mb.name,
        delimiter: mb.delimiter,
        flags: Array.from(mb.flags || []),
        specialUse: mb.specialUse || null,
      }));
    } catch (err: any) {
      console.error("[Email Router] listFolders error:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "フォルダ一覧取得に失敗しました: " + (err.message || "不明なエラー"),
      });
    } finally {
      try { await client.logout(); } catch {}
    }
  }),

  // ===== 6. 特定メールアドレスに関連するメール一覧（受信+送信） =====
  listByAddress: protectedProcedure
    .input(z.object({
      emailAddress: z.string().min(1),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }

      const addr = input.emailAddress.toLowerCase().trim();
      const allEmails: any[] = [];

      const client = await getImapClient();
      try {
        await client.connect();

        // 1) 受信メール（INBOX）からアドレスで検索
        try {
          const inboxLock = await client.getMailboxLock("INBOX");
          try {
            // IMAP SEARCH: FROM に該当アドレスを含むメール
            const inboxUidsResult = await client.search({ from: addr }, { uid: true });
            const inboxUids = Array.isArray(inboxUidsResult) ? inboxUidsResult : [];
            if (inboxUids.length > 0) {
              const uidRange = inboxUids.join(",");
              for await (const message of client.fetch(uidRange, {
                envelope: true,
                flags: true,
                uid: true,
              }, { uid: true })) {
                const envelope = message.envelope;
                allEmails.push({
                  uid: message.uid,
                  folder: "INBOX",
                  direction: "received" as const,
                  subject: envelope.subject || "(件名なし)",
                  from: envelope.from?.[0] ? {
                    name: envelope.from[0].name || "",
                    address: envelope.from[0].address || "",
                  } : { name: "", address: "" },
                  to: (envelope.to || []).map((t: any) => ({
                    name: t.name || "",
                    address: t.address || "",
                  })),
                  date: envelope.date ? new Date(envelope.date).toISOString() : null,
                  flags: Array.from(message.flags || []),
                  seen: message.flags?.has("\\Seen") || false,
                });
              }
            }
          } finally {
            inboxLock.release();
          }
        } catch (e: any) {
          console.warn("[Email Router] listByAddress INBOX search error:", e.message);
        }

        // 2) 送信済みフォルダからアドレスで検索
        try {
          const sentFolders = ["Sent Messages", "Sent", "已发送", "INBOX.Sent"];
          let sentFolder = "Sent Messages";
          const mailboxes = await client.list();
          for (const mb of mailboxes) {
            const path = mb.path || "";
            if (sentFolders.some(f => path.toLowerCase() === f.toLowerCase())) {
              sentFolder = path;
              break;
            }
          }

          const sentLock = await client.getMailboxLock(sentFolder);
          try {
            // IMAP SEARCH: TO に該当アドレスを含むメール
            const sentUidsResult = await client.search({ to: addr }, { uid: true });
            const sentUids = Array.isArray(sentUidsResult) ? sentUidsResult : [];
            if (sentUids.length > 0) {
              const uidRange = sentUids.join(",");
              for await (const message of client.fetch(uidRange, {
                envelope: true,
                flags: true,
                uid: true,
              }, { uid: true })) {
                const envelope = message.envelope;
                allEmails.push({
                  uid: message.uid,
                  folder: sentFolder,
                  direction: "sent" as const,
                  subject: envelope.subject || "(件名なし)",
                  from: envelope.from?.[0] ? {
                    name: envelope.from[0].name || "",
                    address: envelope.from[0].address || "",
                  } : { name: "", address: "" },
                  to: (envelope.to || []).map((t: any) => ({
                    name: t.name || "",
                    address: t.address || "",
                  })),
                  date: envelope.date ? new Date(envelope.date).toISOString() : null,
                  flags: Array.from(message.flags || []),
                  seen: true,
                });
              }
            }
          } finally {
            sentLock.release();
          }
        } catch (e: any) {
          console.warn("[Email Router] listByAddress Sent search error:", e.message);
        }

        // 日付降順ソート
        allEmails.sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });

        // ページネーション
        const total = allEmails.length;
        const start = (input.page - 1) * input.pageSize;
        const paged = allEmails.slice(start, start + input.pageSize);

        return { emails: paged, total, page: input.page, pageSize: input.pageSize };
      } catch (err: any) {
        console.error("[Email Router] listByAddress error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "メール検索に失敗しました: " + (err.message || "不明なエラー"),
        });
      } finally {
        try { await client.logout(); } catch {}
      }
    }),

  // ===== 7. メール削除（ゴミ箱へ移動） =====
  deleteEmail: protectedProcedure
    .input(z.object({
      uid: z.number(),
      folder: z.string().default("INBOX"),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }

      const client = await getImapClient();
      try {
        await client.connect();
        const lock = await client.getMailboxLock(input.folder);
        try {
          await client.messageFlagsAdd(String(input.uid), ["\\Deleted"], { uid: true });
          await client.messageDelete(String(input.uid), { uid: true });
          return { success: true };
        } finally {
          lock.release();
        }
      } catch (err: any) {
        console.error("[Email Router] delete error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "メール削除に失敗しました: " + (err.message || "不明なエラー"),
        });
      } finally {
        try { await client.logout(); } catch {}
      }
    }),

  // ===== 7.5 一括送信用ブランドリスト取得（メールアドレスフィルタ付き） =====
  getBrandsForBulkSend: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(2000).default(500),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { recruitmentBrands } = await import("../drizzle/schema");
      const { eq, sql, and, desc } = await import("drizzle-orm");

      const conditions: any[] = [
        sql`${recruitmentBrands.contactInfo} LIKE '%@%'`
      ];
      if (input.status && input.status !== "_all") {
        conditions.push(eq(recruitmentBrands.status, input.status as any));
      }

      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(recruitmentBrands).where(whereClause);
      const total = countResult?.count || 0;

      const items = await db.select({
        id: recruitmentBrands.id,
        brandName: recruitmentBrands.brandName,
        brandType: recruitmentBrands.brandType,
        status: recruitmentBrands.status,
        contactInfo: recruitmentBrands.contactInfo,
      }).from(recruitmentBrands)
        .where(whereClause)
        .orderBy(desc(recruitmentBrands.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),

  // ===== 8. メールテンプレート一覧 =====
  listTemplates: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const { recruitmentEmailTemplates } = await import("../drizzle/schema");
    const { asc } = await import("drizzle-orm");
    return db.select().from(recruitmentEmailTemplates).orderBy(asc(recruitmentEmailTemplates.sortOrder));
  }),

  // ===== 9. メールテンプレート作成 =====
  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.string().default("general"),
      subject: z.string().min(1),
      body: z.string().min(1),
      variables: z.string().optional(),
      isDefault: z.boolean().default(false),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { recruitmentEmailTemplates } = await import("../drizzle/schema");
      const [result] = await db.insert(recruitmentEmailTemplates).values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { id: result.insertId };
    }),

  // ===== 10. メールテンプレート更新 =====
  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      category: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      variables: z.string().optional(),
      isDefault: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { recruitmentEmailTemplates } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { id, ...data } = input;
      await db.update(recruitmentEmailTemplates).set({ ...data, updatedAt: new Date() }).where(eq(recruitmentEmailTemplates.id, id));
      return { success: true };
    }),

  // ===== 11. メールテンプレート削除 =====
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { recruitmentEmailTemplates } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(recruitmentEmailTemplates).where(eq(recruitmentEmailTemplates.id, input.id));
      return { success: true };
    }),

  // ===== 12. メール署名一覧 =====
  listSignatures: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    const { emailSignatures } = await import("../drizzle/schema");
    return db.select().from(emailSignatures);
  }),

  // ===== 13. メール署名作成/更新 =====
  upsertSignature: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      content: z.string().min(1),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { emailSignatures } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      if (input.isDefault) {
        await db.update(emailSignatures).set({ isDefault: false }).where(eq(emailSignatures.isDefault, true));
      }
      if (input.id) {
        await db.update(emailSignatures).set({ name: input.name, content: input.content, isDefault: input.isDefault, updatedAt: new Date() }).where(eq(emailSignatures.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(emailSignatures).values({ name: input.name, content: input.content, isDefault: input.isDefault, createdAt: new Date(), updatedAt: new Date() });
        return { id: result.insertId };
      }
    }),

  // ===== 13.5. メール署名削除 =====
  deleteSignature: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { emailSignatures } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(emailSignatures).where(eq(emailSignatures.id, input.id));
      return { success: true };
    }),

  // ===== 14. 招商メール送信（テンプレート対応 + ステータス自動更新 + ログ記録） =====
  sendRecruitmentEmail: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      to: z.array(z.string().email()),
      cc: z.array(z.string().email()).optional(),
      subject: z.string().min(1),
      html: z.string().min(1),
      templateId: z.number().optional(),
      sentBy: z.string().optional(),
      autoUpdateStatus: z.boolean().default(true),
      inReplyTo: z.string().optional(),
      references: z.string().optional(),
      attachments: z.array(z.object({
        filename: z.string(),
        contentType: z.string(),
        content: z.string(), // Base64
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }
      try {
        const transporter = createSmtpTransporter();
        const mailOptions: any = {
          from: `"LCJ Inquiry" <${ENV.emailUser}>`,
          to: input.to.join(", "),
          subject: input.subject,
          html: input.html,
        };
        if (input.cc?.length) mailOptions.cc = input.cc.join(", ");
        if (input.inReplyTo) mailOptions.inReplyTo = input.inReplyTo;
        if (input.references) mailOptions.references = input.references;
        if (input.attachments?.length) {
          mailOptions.attachments = input.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            content: Buffer.from(att.content, "base64"),
          }));
        }
        const info = await transporter.sendMail(mailOptions);
        console.log("[Email Router] Recruitment email sent:", info.messageId);

        // ログ記録（body + sentBy保存）
        const { getDb } = await import("./db");
        const db = await getDb();
        const { recruitmentEmailLogs, recruitmentBrands } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.insert(recruitmentEmailLogs).values({
          brandId: input.brandId,
          templateId: input.templateId || null,
          toAddress: input.to.join(", "),
          subject: input.subject,
          sentBy: input.sentBy || "system",
          sentAt: new Date(),
          isBulk: false,
        });

        // ステータス自動更新
        if (input.autoUpdateStatus) {
          const [brand] = await db.select({ status: recruitmentBrands.status }).from(recruitmentBrands).where(eq(recruitmentBrands.id, input.brandId));
          if (brand && brand.status === "registered") {
            await db.update(recruitmentBrands).set({ status: "email_sent" }).where(eq(recruitmentBrands.id, input.brandId));
          }
        }

        return { success: true, messageId: info.messageId };
      } catch (err: any) {
        console.error("[Email Router] Recruitment send error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール送信に失敗しました: " + (err.message || "不明なエラー") });
      }
    }),

  // ===== 15. 一括メール送信 =====
  sendBulkRecruitmentEmail: protectedProcedure
    .input(z.object({
      brandIds: z.array(z.number()).min(1),
      subject: z.string().min(1),
      bodyTemplate: z.string().min(1),
      templateId: z.number().optional(),
      autoUpdateStatus: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.emailUser || !ENV.emailPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
      }
      const { getDb } = await import("./db");
      const db = await getDb();
      const { recruitmentBrands, recruitmentEmailLogs } = await import("../drizzle/schema");
      const { eq, inArray } = await import("drizzle-orm");

      const brands = await db.select({
        id: recruitmentBrands.id,
        brandName: recruitmentBrands.brandName,
        contactInfo: recruitmentBrands.contactInfo,
        status: recruitmentBrands.status,
      }).from(recruitmentBrands).where(inArray(recruitmentBrands.id, input.brandIds));

      const extractEmail = (text: string | null): string | null => {
        if (!text) return null;
        const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        return match ? match[0] : null;
      };

      const transporter = createSmtpTransporter();
      let sent = 0, failed = 0;
      const errors: string[] = [];

      for (const brand of brands) {
        const brandEmail = extractEmail(brand.contactInfo);
        if (!brandEmail) {
          errors.push(`${brand.brandName}: メールアドレスなし`);
          failed++;
          continue;
        }
        try {
          // テンプレート変数置換
          const html = input.bodyTemplate
            .replace(/\{\{brandName\}\}/g, brand.brandName || "")
            .replace(/\{\{contactPerson\}\}/g, "ご担当者")
            .replace(/\n/g, "<br>");
          const subject = input.subject
            .replace(/\{\{brandName\}\}/g, brand.brandName || "");

          await transporter.sendMail({
            from: `"LCJ Inquiry" <${ENV.emailUser}>`,
            to: brandEmail,
            subject,
            html,
          });

          // ログ記録（sentBy保存）
          await db.insert(recruitmentEmailLogs).values({
            brandId: brand.id,
            templateId: input.templateId || null,
            toAddress: brandEmail,
            subject,
            sentBy: "bulk_send",
            sentAt: new Date(),
            isBulk: true,
          });

          // ステータス自動更新
          if (input.autoUpdateStatus && brand.status === "registered") {
            await db.update(recruitmentBrands).set({ status: "email_sent" }).where(eq(recruitmentBrands.id, brand.id));
          }

          sent++;
          // レート制限（2秒間隔 - Alibaba Cloud制限対策）
          await new Promise(r => setTimeout(r, 2000));
        } catch (err: any) {
          errors.push(`${brand.brandName}: ${err.message}`);
          failed++;
        }
      }

      return { sent, failed, total: brands.length, errors };
    }),

  // ===== 16. 招商メール送信ログ取得 =====
  getRecruitmentEmailLogs: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { recruitmentEmailLogs } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(recruitmentEmailLogs).where(eq(recruitmentEmailLogs.brandId, input.brandId)).orderBy(desc(recruitmentEmailLogs.sentAt)).limit(50);
    }),

  // ===== 17. 全送信ログ取得（ダッシュボード用） =====
  getAllEmailLogs: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
      isBulk: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      const { recruitmentEmailLogs, recruitmentBrands } = await import("../drizzle/schema");
      const { desc, eq, sql } = await import("drizzle-orm");

      // 総数取得
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(recruitmentEmailLogs);
      const total = countResult?.count || 0;

      // ログ取得（ブランド名JOIN）
      const logs = await db
        .select({
          id: recruitmentEmailLogs.id,
          brandId: recruitmentEmailLogs.brandId,
          brandName: recruitmentBrands.brandName,
          templateId: recruitmentEmailLogs.templateId,
          toAddress: recruitmentEmailLogs.toAddress,
          subject: recruitmentEmailLogs.subject,
          sentBy: recruitmentEmailLogs.sentBy,
          sentAt: recruitmentEmailLogs.sentAt,
          isBulk: recruitmentEmailLogs.isBulk,
        })
        .from(recruitmentEmailLogs)
        .leftJoin(recruitmentBrands, eq(recruitmentEmailLogs.brandId, recruitmentBrands.id))
        .orderBy(desc(recruitmentEmailLogs.sentAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return { logs, total, page: input.page, pageSize: input.pageSize };
    }),
});

export const replyTrackingRouter = router({
  // 未返信カウント取得（バッジ表示用）
  getUnrepliedCount: protectedProcedure.query(async () => {
    const count = await getUnrepliedCount();
    return { count };
  }),

  // 未返信メール一覧取得
  getUnrepliedEmails: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const result = await getUnrepliedEmails(input.pageSize, (input.page - 1) * input.pageSize);
      return { ...result, page: input.page, pageSize: input.pageSize };
    }),

  // IMAP受信トレイをスキャンして返信を検出
  checkReplies: protectedProcedure.mutation(async () => {
    if (!ENV.emailUser || !ENV.emailPassword) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "メール設定が未構成です" });
    }

    // 1. salesEmailLogsから送信済みメールアドレスを取得
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続不可" });

    const { salesEmailLogs } = await import("../drizzle/schema");
    const { eq, and, desc } = await import("drizzle-orm");

    // 送信済み・未返信のメールアドレスを取得
    const sentEmails = await db
      .select({
        id: salesEmailLogs.id,
        toEmail: salesEmailLogs.toEmail,
      })
      .from(salesEmailLogs)
      .where(
        and(
          eq(salesEmailLogs.status, "sent"),
          eq(salesEmailLogs.replyReceived, false)
        )
      );

    if (sentEmails.length === 0) {
      return { checked: 0, newReplies: 0, message: "送信済み未返信メールがありません" };
    }

    // 送信先アドレスのセットを作成
    const sentAddressSet = new Set(sentEmails.map(e => e.toEmail.toLowerCase()));

    // 2. IMAP受信トレイをスキャンして返信を検出
    const client = await getImapClient();
    let newReplies = 0;
    const repliedAddresses: string[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const mailbox = client.mailbox;
        const total = mailbox?.exists ?? 0;
        if (total === 0) {
          return { checked: sentEmails.length, newReplies: 0, message: "受信トレイが空です" };
        }

        // 最新500件をスキャン（パフォーマンスのため制限）
        const scanCount = Math.min(total, 500);
        const start = Math.max(1, total - scanCount + 1);
        const range = `${start}:${total}`;

        for await (const message of client.fetch(range, {
          envelope: true,
          uid: true,
        })) {
          const envelope = message.envelope;
          if (!envelope?.from?.[0]?.address) continue;

          const fromAddress = (envelope.from[0].address || "").toLowerCase();

          // 送信先アドレスからの受信メールを検出
          if (sentAddressSet.has(fromAddress) && !repliedAddresses.includes(fromAddress)) {
            repliedAddresses.push(fromAddress);
          }
        }
      } finally {
        lock.release();
      }
    } catch (err: any) {
      console.error("[Reply Tracking] IMAP scan error:", err.message);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "IMAP受信トレイのスキャンに失敗しました: " + (err.message || "不明なエラー"),
      });
    } finally {
      try { await client.logout(); } catch {}
    }

    // 3. 検出した返信をDBに反映
    for (const addr of repliedAddresses) {
      try {
        const affected = await markReplyReceivedByEmail(addr);
        if (affected > 0) newReplies++;
      } catch (err: any) {
        console.error(`[Reply Tracking] Error marking reply for ${addr}:`, err.message);
      }
    }

    return {
      checked: sentEmails.length,
      scannedInbox: Math.min(500, sentEmails.length),
      newReplies,
      repliedAddresses,
      message: newReplies > 0
        ? `${newReplies}件の新しい返信を検出しました`
        : "新しい返信はありませんでした",
    };
  }),

  // こちらからの返信済みをマーク
  markReplied: protectedProcedure
    .input(z.object({ emailLogId: z.number() }))
    .mutation(async ({ input }) => {
      await markRepliedByUs(input.emailLogId);
      return { success: true };
    }),
});
