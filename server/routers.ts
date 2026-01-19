import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import {
  createStaff,
  getAllStaff,
  getActiveStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  createTask,
  getAllTasks,
  getAllTasksWithUsers,
  getTasksByStatus,
  getTasksByStaffId,
  getTaskById,
  getTaskByTaskId,
  updateTask,
  deleteTask,
  searchTasks,
  getInProgressTasks,
  createReminder,
  getRemindersByTaskId,
  getTaskStatistics,
  getAverageCompletionTime,
  assignStaffToTask,
  getStaffByTaskId,
  getRecentCompletedTasks,
  getStaffWithTaskCounts,
  getOverdueTasks,
  createEmailTracking,
  getEmailTrackingByTaskId,
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
  getStaffReportStatistics,
  searchReports,
  getReportsForAnalysis,
  createReportStaff,
  getAllReportStaff,
  getActiveReportStaff,
  getReportStaffById,
  updateReportStaff,
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
  createBrandProduct,
  getProductsByBrandId,
  updateBrandProduct,
  deleteBrandProduct,
  createBrandActivity,
  getActivitiesByBrandId,
  updateBrandActivity,
  deleteBrandActivity,
  getBrandStatistics,
  deleteReportStaff,
  getReportStaffByCountry,
  createBrandLivestream,
  getLivestreamsByBrandId,
  updateBrandLivestream,
  deleteBrandLivestream,
  getLivestreamStatsByBrandId,
  createReportFollowup,
  getPendingFollowups,
  getOverdueFollowups,
  updateFollowupStatus,
  getFollowupsByReportId,
  getFollowupsByStaffId,
  deleteReportFollowup,
  checkExistingFollowup,
  getFollowupById,
  getCompletedFollowups,
  linkNextAction,
  createBusinessCard,
  getBusinessCardById,
  getBusinessCards,
  checkDuplicateBusinessCard,
  updateBusinessCard,
  deleteBusinessCard,
  getBusinessCardCount,
  getBrandLcjStaff,
  assignLcjStaffToBrand,
  removeLcjStaffFromBrand,
  setBrandLcjStaff,
  getBrandsByLcjStaff,
  createActivityLog,
  getRecentActivityLogs,
  getActivityLogsByUser,
  getAllUsers,
  getUserActivityStats,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { authRouter } from "./auth";
import { checkAndSendReminders } from "./reminderScheduler";
import { completionRouter } from "./completion";
import { sendReminderEmail } from "./emailService";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  completion: completionRouter,

  reminder: router({
    sendNow: protectedProcedure.mutation(async () => {
      const result = await checkAndSendReminders();
      return result;
    }),
  }),

  staff: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().min(1).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"),
          department: z.string().optional(),
          country: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createStaff({
          name: input.name,
          email: input.email,
          department: input.department,
          country: input.country,
          isActive: "active",
        });
        return { success: true };
      }),

    list: protectedProcedure.query(async () => {
      return await getAllStaff();
    }),

    listActive: protectedProcedure.query(async () => {
      return await getActiveStaff();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getStaffById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          email: z.string().min(1).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format").optional(),
          department: z.string().optional(),
          country: z.string().optional(),
          isActive: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        await updateStaff(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteStaff(input.id);
        return { success: true };
      }),

    getTaskCounts: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        const tasksWithStaff = await getTasksByStaffId(input.staffId);
        const now = new Date();
        
        const inProgressCount = tasksWithStaff.filter(t => t.task.status === "in_progress").length;
        const completedCount = tasksWithStaff.filter(t => t.task.status === "completed").length;
        const overdueCount = tasksWithStaff.filter(t => 
          t.task.status === "in_progress" && 
          t.task.deadline && 
          new Date(t.task.deadline) < now
        ).length;
        
        return {
          inProgressCount,
          completedCount,
          overdueCount,
          totalCount: tasksWithStaff.length,
        };
      }),
  }),

  task: router({
    create: protectedProcedure
      .input(
        z.object({
          screenshots: z.array(z.object({
            base64: z.string(),
            mimeType: z.string(),
          })).min(1).max(4), // Support 1-4 screenshots
          staffIds: z.array(z.number()).min(1), // Support multiple staff members
          manualDeadline: z.string().optional(), // Manual deadline input (ISO 8601 format)
          notes: z.string().optional(), // Optional memo field
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Upload all screenshots to S3
        const uploadedScreenshots = await Promise.all(
          input.screenshots.map(async (screenshot) => {
            const buffer = Buffer.from(screenshot.base64, "base64");
            const fileKey = `screenshots/${ctx.user.id}/${nanoid()}.${screenshot.mimeType.split("/")[1]}`;
            const { url } = await storagePut(fileKey, buffer, screenshot.mimeType);
            return { url, key: fileKey };
          })
        );

        const screenshotUrls = uploadedScreenshots.map(s => s.url);
        const screenshotKeys = uploadedScreenshots.map(s => s.key);
              // Build content array with all screenshots
        const userContent: any[] = [
          {
            type: "text",
            text: screenshotUrls.length > 1 
              ? `これら${screenshotUrls.length}枚のスクリーンショットから業務指示を抽出してください。複数の画像に分かれている情報を統合して、完全なタスク情報を抽出してください。`
              : "このスクリーンショットから業務指示を抽出してください。",
          },
        ];

        // Add all screenshots to content
        for (const screenshotUrl of screenshotUrls) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: screenshotUrl,
              detail: "high",
            },
          });
        }

        // Use AI to extract task information from all screenshots
        const aiResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "あなたは業務指示を抽出するアシスタントです。スクリーンショットからタスクの要約、詳細なコンテキスト、期限を抽出してください。複数の画像がある場合は、全ての情報を統合して完全なタスク情報を抽出してください。",
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "task_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  taskSummary: { type: "string", description: "指示内容の簡潔な要約" },
                  detailedContext: { type: "string", description: "詳細なコンテキスト" },
                  deadline: { type: "string", description: "期限（ISO 8601形式、不明な場合は空文字列）" },
                },
                required: ["taskSummary", "detailedContext", "deadline"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = aiResponse.choices[0]?.message?.content;
        const extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
        const taskId = `TASK-${nanoid(10)}`;
        const completionToken = nanoid(32); // Generate unique completion token
        const startDate = Date.now();

        // Parse deadline: prioritize manual input over AI extraction
        let deadline: Date | null = null;
        
        // First, try manual deadline input (user input has priority)
        if (input.manualDeadline && input.manualDeadline.trim() !== "") {
          try {
            const parsedDate = new Date(input.manualDeadline);
            if (!isNaN(parsedDate.getTime())) {
              deadline = parsedDate;
              console.log("[Task Create] Using manual deadline:", deadline);
            }
          } catch (error) {
            console.warn("[Task Create] Failed to parse manual deadline:", input.manualDeadline);
          }
        }
        
        // If no manual deadline, try AI-extracted deadline
        if (!deadline && extractedData.deadline && extractedData.deadline.trim() !== "") {
          try {
            const parsedDate = new Date(extractedData.deadline);
            if (!isNaN(parsedDate.getTime())) {
              deadline = parsedDate;
              console.log("[Task Create] Using AI-extracted deadline:", deadline);
            }
          } catch (error) {
            console.warn("[Task Create] Failed to parse AI deadline:", extractedData.deadline);
          }
        }

        // Create task in database
        const createdTask = await createTask({
          taskId,
          status: "in_progress",
          staffId: input.staffIds[0], // Keep first staff for backward compatibility
          taskDetail: extractedData.taskSummary || "指示内容を確認してください",
          extractedContext: extractedData.detailedContext || "",
          deadline,
          screenshotUrl: screenshotUrls[0], // Keep for backward compatibility
          screenshotKey: screenshotKeys[0], // Keep for backward compatibility
          screenshotUrls,
          screenshotKeys,
          completionToken,
          notes: input.notes, // Save optional notes
          startDate,
          createdBy: ctx.user.id,
        });

        if (!createdTask || !createdTask.id) {
          throw new Error("Failed to create task");
        }

        console.log("[Task Create] Created task with ID:", createdTask.id);

        // Assign all staff members to the task using junction table
        await assignStaffToTask(createdTask.id, input.staffIds);

        // Send initial reminder email to all assigned staff members
        const assignedStaff = await Promise.all(
          input.staffIds.map(staffId => getStaffById(staffId))
        );
        
        for (const staff of assignedStaff) {
          if (staff) {
            // Generate tracking token
            const trackingToken = nanoid(32);
            
            // Send email with tracking
            await sendReminderEmail(
              staff.email,
              staff.name,
              extractedData.taskSummary || "指示内容を確認してください",
              taskId,
              0, // 0 days elapsed (initial reminder)
              completionToken,
              screenshotUrls,
              input.notes,
              deadline ? deadline.getTime() : undefined,
              trackingToken
            );
            
            // Create reminder record
            const reminderResult = await createReminder({
              taskId: createdTask.id,
              sentAt: startDate,
              recipientEmail: staff.email,
              emailSubject: `【リマインド/提醒】タスクの進捗確認 / 任务进度确认: ${extractedData.taskSummary?.substring(0, 50)}...`,
              emailBody: extractedData.taskSummary || "",
              status: "sent",
            });
            
            // Create email tracking record
            // Note: We use a placeholder reminderId since we can't get the auto-increment ID from drizzle
            await createEmailTracking({
              reminderId: 0, // Will be updated later if needed
              taskId: createdTask.id,
              trackingToken,
              openedAt: null,
              openCount: 0,
              ipAddress: null,
              userAgent: null,
            });
          }
        }

        // Notify owner
        await notifyOwner({
          title: "新規タスクが登録されました",
          content: `タスクID: ${taskId}\n指示内容: ${extractedData.taskSummary}`,
        });

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "task_create",
          actionLabel: "タスクを作成",
          targetId: createdTask.id,
          targetName: extractedData.taskSummary?.substring(0, 50) || taskId,
        });

        return {
          success: true,
          taskId,
          extractedData,
        };
      }),

    list: protectedProcedure.query(async () => {
      return await getAllTasks();
    }),

    listAllWithUsers: protectedProcedure.query(async () => {
      return await getAllTasksWithUsers();
    }),

    listByStatus: protectedProcedure
      .input(z.object({ status: z.enum(["pending", "in_progress", "completed", "cancelled"]) }))
      .query(async ({ input }) => {
        return await getTasksByStatus(input.status);
      }),

    listByStaffId: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        return await getTasksByStaffId(input.staffId);
      }),

    getTasksByStaff: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        const tasks = await getTasksByStaffId(input.staffId);
        const staff = await getStaffById(input.staffId);
        return {
          staff,
          tasks,
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getTaskById(input.id);
      }),

    getStaffByTaskId: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getStaffByTaskId(input.taskId);
      }),

    search: protectedProcedure
      .input(z.object({ searchTerm: z.string() }))
      .query(async ({ input }) => {
        return await searchTasks(input.searchTerm);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
          taskDetail: z.string().optional(),
          deadline: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, deadline, ...updateData } = input;
        const finalUpdateData: any = { ...updateData };

        if (deadline) {
          finalUpdateData.deadline = new Date(deadline);
        }

        if (input.status === "completed") {
          finalUpdateData.completedAt = Date.now();
        }

        await updateTask(id, finalUpdateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTask(input.id);
        return { success: true };
      }),

    sendReminder: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const taskData = await getTaskById(input.taskId);
        if (!taskData) {
          throw new Error("Task not found");
        }

        const { task } = taskData;

        // Get all assigned staff members
        const assignedStaff = await getStaffByTaskId(input.taskId);
        if (!assignedStaff || assignedStaff.length === 0) {
          throw new Error("No staff assigned to this task");
        }

        // Calculate days elapsed
        const daysElapsed = Math.floor(
          (Date.now() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send reminder email to all assigned staff members
        const emailResults = await Promise.all(
          assignedStaff.map(async (item) => {
            if (!item.staff) return { success: false, error: "Staff not found" };

            // Generate tracking token
            const trackingToken = nanoid(32);

            const emailResult = await sendReminderEmail(
              item.staff.email,
              item.staff.name,
              task.taskDetail,
              task.taskId,
              daysElapsed,
              task.completionToken || undefined,
              task.screenshotUrls || (task.screenshotUrl ? [task.screenshotUrl] : undefined),
              task.notes || undefined,
              task.deadline ? task.deadline.getTime() : undefined,
              trackingToken
            );

            if (emailResult.success) {
              // Create reminder record
              await createReminder({
                taskId: task.id,
                sentAt: Date.now(),
                recipientEmail: item.staff.email,
                emailSubject: `【リマインド】${task.taskDetail}`,
                emailBody: `${item.staff.name}様\n\n以下のタスクについてリマインドいたします。\n\nタスクID: ${task.taskId}\n内容: ${task.taskDetail}\n\nご確認をお願いいたします。`,
                status: "sent",
              });
              
              // Create email tracking record
              await createEmailTracking({
                reminderId: 0,
                taskId: task.id,
                trackingToken,
                openedAt: null,
                openCount: 0,
                ipAddress: null,
                userAgent: null,
              });
            }

            return emailResult;
          })
        );

        // Check if any email failed
        const failedEmails = emailResults.filter(result => !result.success);
        if (failedEmails.length > 0) {
          throw new Error(`${failedEmails.length}件のメール送信に失敗しました`);
        }

        return { success: true, sentCount: emailResults.length };
      }),

    getReminders: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getRemindersByTaskId(input.taskId);
      }),

    getEmailTracking: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getEmailTrackingByTaskId(input.taskId);
      }),

    checkCompletion: protectedProcedure
      .input(
        z.object({
          taskId: z.string(),
          emailContent: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        // Use AI to determine if the email indicates task completion
        const aiResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "あなたは業務完了報告を判定するアシスタントです。メール内容から、タスクが完了したかどうかを判定してください。",
            },
            {
              role: "user",
              content: `以下のメール内容を分析して、タスクが完了したかどうかを判定してください：\n\n${input.emailContent}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "completion_check",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  isCompleted: { type: "boolean", description: "タスクが完了したかどうか" },
                  confidence: { type: "number", description: "判定の信頼度（0-1）" },
                  reason: { type: "string", description: "判定理由" },
                },
                required: ["isCompleted", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = aiResponse.choices[0]?.message?.content;
        const result = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");

        if (result.isCompleted && result.confidence > 0.7) {
          const taskData = await getTaskByTaskId(input.taskId);
          if (taskData) {
            await updateTask(taskData.task.id, {
              status: "completed",
              completedAt: Date.now(),
            });

            // Notify owner
            await notifyOwner({
              title: "タスクが完了しました",
              content: `タスクID: ${input.taskId}\n内容: ${taskData.task.taskDetail}`,
            });
          }
        }

        return {
          success: true,
          result,
        };
      }),
  }),

  dashboard: router({
    statistics: protectedProcedure.query(async () => {
      const stats = await getTaskStatistics();
      const avgCompletionTime = await getAverageCompletionTime();
      const recentCompleted = await getRecentCompletedTasks(5);
      const overdueTasks = await getOverdueTasks();

      return {
        stats,
        avgCompletionTime,
        recentCompleted,
        overdueTasks,
      };
    }),

    staffWithTaskCounts: protectedProcedure.query(async () => {
      return await getStaffWithTaskCounts();
    }),
  }),

  // Report Staff router (separate from task staff)
  reportStaff: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          country: z.string().min(1),
          linkedStaffId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const reportStaffMember = await createReportStaff({
          name: input.name,
          country: input.country,
          linkedStaffId: input.linkedStaffId || null,
        });
        return reportStaffMember;
      }),

    list: protectedProcedure.query(async () => {
      return await getAllReportStaff();
    }),

    listActive: protectedProcedure.query(async () => {
      return await getActiveReportStaff();
    }),

    listByCountry: protectedProcedure
      .input(z.object({ country: z.string() }))
      .query(async ({ input }) => {
        return await getReportStaffByCountry(input.country);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getReportStaffById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          country: z.string().optional(),
          linkedStaffId: z.number().nullable().optional(),
          isActive: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        await updateReportStaff(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReportStaff(input.id);
        return { success: true };
      }),
  }),

  report: router({
    create: protectedProcedure
      .input(
        z.object({
          reportStaffId: z.number(),
          reportDate: z.string(), // ISO 8601 format
          workContent: z.string().min(1),
          issues: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const report = await createReport({
          reportStaffId: input.reportStaffId,
          reportDate: new Date(input.reportDate),
          workContent: input.workContent,
          issues: input.issues || null,
          remarks: input.remarks || null,
          createdBy: ctx.user.id,
        });
        
        // Record activity log
        if (report && report.id) {
          await createActivityLog({
            userId: ctx.user.id,
            actionType: "report_create",
            actionLabel: "レポートを提出",
            targetId: report.id,
            targetName: input.workContent.substring(0, 50),
          });
        }
        
        return report;
      }),

    list: protectedProcedure
      .input(
        z.object({
          reportStaffId: z.number().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          searchTerm: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        if (!input || Object.keys(input).length === 0) {
          return await getAllReports();
        }
        
        return await searchReports({
          reportStaffId: input.reportStaffId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          searchTerm: input.searchTerm,
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getReportById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          reportStaffId: z.number().optional(),
          reportDate: z.string().optional(),
          workContent: z.string().optional(),
          issues: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const data: any = { ...updateData };
        if (updateData.reportDate) {
          data.reportDate = new Date(updateData.reportDate);
        }
        await updateReport(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReport(input.id);
        return { success: true };
      }),

    staffStatistics: protectedProcedure.query(async () => {
      return await getStaffReportStatistics();
    }),

    // AI Analysis: Individual staff analysis
    analyzeIndividual: protectedProcedure
      .input(
        z.object({
          reportStaffId: z.number(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reports = await getReportsForAnalysis({
          reportStaffId: input.reportStaffId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });

        if (reports.length === 0) {
          return {
            success: false,
            error: input.language === "ja" ? "分析対象の日報がありません" : "没有可分析的日报",
          };
        }

        const staffName = reports[0].staff?.name || "不明";
        const reportContents = reports.map(r => ({
          date: r.report.reportDate,
          workContent: r.report.workContent,
          issues: r.report.issues,
          remarks: r.report.remarks,
        }));

        const systemPrompt = input.language === "ja" 
          ? `あなたは業務分析の専門家です。以下の日報データを分析し、個人の作業傾向を詳細に分析してください。

分析項目:
1. 主な作業カテゴリ（作業内容をカテゴリ別に分類）
2. 作業の特徴と強み
3. 課題や改善点
4. 今後の提案

日本語で回答してください。`
          : `你是一位业务分析专家。请分析以下日报数据，详细分析个人的工作趋势。

分析项目:
1. 主要工作类别（按类别分类工作内容）
2. 工作特点和优势
3. 课题和改进点
4. 未来建议

请用中文回答。`;

        const userPrompt = `スタッフ名: ${staffName}
分析期間: ${reports.length}件の日報

日報データ:
${JSON.stringify(reportContents, null, 2)}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const analysis = response.choices[0]?.message?.content || "";

          return {
            success: true,
            staffName,
            reportCount: reports.length,
            analysis: typeof analysis === "string" ? analysis : JSON.stringify(analysis),
          };
        } catch (error) {
          console.error("AI analysis error:", error);
          return {
            success: false,
            error: input.language === "ja" ? "AI分析中にエラーが発生しました" : "AI分析过程中发生错误",
          };
        }
      }),

    // AI Analysis: Team summary
    analyzeTeam: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          country: z.string().optional(),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reports = await getReportsForAnalysis({
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          country: input.country,
        });

        if (reports.length === 0) {
          return {
            success: false,
            error: input.language === "ja" ? "分析対象の日報がありません" : "没有可分析的日报",
          };
        }

        // Group reports by staff
        const staffReports: Record<string, { name: string; reports: any[] }> = {};
        for (const r of reports) {
          const staffId = r.staff?.id?.toString() || "unknown";
          const staffName = r.staff?.name || "不明";
          if (!staffReports[staffId]) {
            staffReports[staffId] = { name: staffName, reports: [] };
          }
          staffReports[staffId].reports.push({
            date: r.report.reportDate,
            workContent: r.report.workContent,
            issues: r.report.issues,
          });
        }

        const teamSummary = Object.entries(staffReports).map(([id, data]) => ({
          staffName: data.name,
          reportCount: data.reports.length,
          recentWork: data.reports.slice(0, 3).map(r => r.workContent).join("\n"),
          issues: data.reports.filter(r => r.issues).map(r => r.issues).slice(0, 3),
        }));

        const systemPrompt = input.language === "ja"
          ? `あなたはチームマネジメントの専門家です。以下のチーム日報データを分析し、チーム全体の進捗サマリーを作成してください。

分析項目:
1. チーム全体の進捗概要
2. 各メンバーの貫献度
3. チーム全体の課題・ボトルネック
4. 改善提案とアクションアイテム

日本語で回答してください。`
          : `你是一位团队管理专家。请分析以下团队日报数据，创建团队整体进度摘要。

分析项目:
1. 团队整体进度概要
2. 各成员的贡献度
3. 团队整体的课题和瓶颈
4. 改进建议和行动项目

请用中文回答。`;

        const userPrompt = `チームメンバー数: ${Object.keys(staffReports).length}人
総日報数: ${reports.length}件
${input.country ? `国: ${input.country}` : ""}

チームデータ:
${JSON.stringify(teamSummary, null, 2)}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const analysis = response.choices[0]?.message?.content || "";

          return {
            success: true,
            memberCount: Object.keys(staffReports).length,
            reportCount: reports.length,
            analysis: typeof analysis === "string" ? analysis : JSON.stringify(analysis),
          };
        } catch (error) {
          console.error("AI team analysis error:", error);
          return {
            success: false,
            error: input.language === "ja" ? "AI分析中にエラーが発生しました" : "AI分析过程中发生错误",
          };
        }
      }),

    // Extract followup items from reports using AI
    extractFollowups: protectedProcedure
      .input(
        z.object({
          reportId: z.number(),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reportData = await getReportById(input.reportId);
        if (!reportData) {
          return { success: false, error: "Report not found" };
        }

        const { report, staff } = reportData;
        const workContent = report.workContent || "";

        // Keywords to detect followup items
        const followupKeywords = [
          "提案", "打ち合わせ", "商談", "MTG", "ミーティング", "会議",
          "確認", "検討", "相談", "調整", "連絡", "報告",
          "合同", "会合", "面談", "訪問", "見積", "契約",
          "提议", "会议", "商谈", "确认", "讨论", "协商", "联系"
        ];

        const systemPrompt = input.language === "ja"
          ? `あなたは業務内容からフォローアップが必要な項目を抽出する専門家です。

以下の日報内容から、フォローアップが必要な項目（提案、打ち合わせ、商談、MTG、確認事項など）を抽出してください。

出力形式（JSON配列）:
[
  {
    "item": "抽出された項目（簡潔に）",
    "category": "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他"
  }
]

該当する項目がない場合は空の配列 [] を返してください。`
          : `你是一位从工作内容中提取需要跟进事项的专家。

请从以下日报内容中提取需要跟进的事项（提案、会议、商谈、MTG、确认事项等）。

输出格式（JSON数组）:
[
  {
    "item": "提取的事项（简洁）",
    "category": "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他"
  }
]

如果没有相关事项，请返回空数组 []。`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `日報内容:\n${workContent}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "followup_items",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          category: { type: "string" }
                        },
                        required: ["item", "category"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["items"],
                  additionalProperties: false
                }
              }
            }
          });

          const rawContent = response.choices[0]?.message?.content || "{}";
          const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
          const parsed = JSON.parse(content);
          const extractedItems = parsed.items || [];

          // Calculate due date (2 days from report date)
          const reportDate = new Date(report.reportDate);
          const dueDate = new Date(reportDate);
          dueDate.setDate(dueDate.getDate() + 2);

          // Create followup records
          const createdFollowups = [];
          for (const item of extractedItems) {
            // Check if already exists
            const existing = await checkExistingFollowup(report.id, item.item);
            if (!existing) {
              const category = ["提案", "打ち合わせ", "商談", "MTG", "確認"].includes(item.category)
                ? item.category as "提案" | "打ち合わせ" | "商談" | "MTG" | "確認"
                : "その他";
              
              const followup = await createReportFollowup({
                reportId: report.id,
                reportStaffId: report.reportStaffId,
                extractedItem: item.item,
                category,
                status: "pending",
                dueDate,
              });
              if (followup) {
                createdFollowups.push(followup);
              }
            }
          }

          return {
            success: true,
            extractedCount: extractedItems.length,
            createdCount: createdFollowups.length,
            items: createdFollowups,
          };
        } catch (error) {
          console.error("Followup extraction error:", error);
          return {
            success: false,
            error: input.language === "ja" ? "フォローアップ抽出中にエラーが発生しました" : "跟进事项提取过程中发生错误",
          };
        }
      }),

    // Get all pending followups
    pendingFollowups: protectedProcedure.query(async () => {
      return await getPendingFollowups();
    }),

    // Get overdue followups (for highlighting) with optional staff filter
    overdueFollowups: protectedProcedure
      .input(z.object({ staffId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getOverdueFollowups(input?.staffId);
      }),

    // Get completed followups with optional staff filter
    completedFollowups: protectedProcedure
      .input(z.object({ staffId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getCompletedFollowups(input?.staffId);
      }),

    // Update followup status with result recording
    updateFollowupStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "completed", "cancelled"]),
          resultCategory: z.enum(["成約", "継続", "保留", "失注", "完了"]).optional(),
          resultNote: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateFollowupStatus(input.id, input.status, input.resultCategory, input.resultNote);
        return { success: true };
      }),

    // Complete followup with result and generate next action suggestion
    completeWithResult: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          resultCategory: z.enum(["成約", "継続", "保留", "失注", "完了"]),
          resultNote: z.string().optional(),
          createNextAction: z.boolean().default(false),
          nextActionItem: z.string().optional(),
          nextActionCategory: z.enum(["提案", "打ち合わせ", "商談", "MTG", "確認", "その他"]).optional(),
          nextActionDueDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get the current followup to get reportId and staffId
        const currentFollowup = await getFollowupById(input.id);
        if (!currentFollowup) {
          throw new Error("Followup not found");
        }

        // Update the current followup with result
        await updateFollowupStatus(input.id, "completed", input.resultCategory, input.resultNote);

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "followup_complete",
          actionLabel: "フォローアップを完了",
          targetId: input.id,
          targetName: currentFollowup.extractedItem?.substring(0, 50) || `フォローアップ #${input.id}`,
        });

        let nextActionId = null;

        // Create next action if requested
        if (input.createNextAction && input.nextActionItem) {
          const nextAction = await createReportFollowup({
            reportId: currentFollowup.reportId,
            reportStaffId: currentFollowup.reportStaffId,
            extractedItem: input.nextActionItem,
            category: input.nextActionCategory || "その他",
            dueDate: input.nextActionDueDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          });
          if (nextAction) {
            nextActionId = nextAction.id;
            // Link the next action to the current followup
            await linkNextAction(input.id, nextActionId);
          }
        }

        return { success: true, nextActionId };
      }),

    // AI suggest next action based on followup content and result
    suggestNextAction: protectedProcedure
      .input(
        z.object({
          followupId: z.number(),
          resultCategory: z.enum(["成約", "継続", "保留", "失注", "完了"]),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const followup = await getFollowupById(input.followupId);
        if (!followup) {
          throw new Error("Followup not found");
        }

        // Only suggest next action for "継続" or "保留"
        if (input.resultCategory !== "継続" && input.resultCategory !== "保留") {
          return { suggestion: null, reason: "この結果には次のアクションは不要です" };
        }

        const prompt = input.language === "ja" 
          ? `以下のフォローアップ項目の結果が「${input.resultCategory}」です。次のアクションを提案してください。

元の項目: ${followup.extractedItem}
カテゴリ: ${followup.category}

以下のJSON形式で回答してください:
{
  "nextAction": "次のアクションの内容（30文字以内）",
  "category": "提案|打ち合わせ|商談|MTG|確認|その他",
  "daysUntilDue": 2-7の数字
}`
          : `以下跟进事项的结果是「${input.resultCategory}」。请提议下一步行动。

原始事项: ${followup.extractedItem}
类别: ${followup.category}

请以以下JSON格式回复:
{
  "nextAction": "下一步行动内容（30字以内）",
  "category": "提案|打ち合わせ|商談|MTG|確認|その他",
  "daysUntilDue": 2-7的数字
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "あなたはビジネスアシスタントです。簡潔に次のアクションを提案してください。" },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "next_action_suggestion",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    nextAction: { type: "string" },
                    category: { type: "string" },
                    daysUntilDue: { type: "number" },
                  },
                  required: ["nextAction", "category", "daysUntilDue"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (content && typeof content === 'string') {
            const suggestion = JSON.parse(content);
            return {
              suggestion: {
                item: suggestion.nextAction,
                category: suggestion.category,
                dueDate: new Date(Date.now() + suggestion.daysUntilDue * 24 * 60 * 60 * 1000),
              },
            };
          }
        } catch (error) {
          console.error("Error suggesting next action:", error);
        }

        return { suggestion: null };
      }),

    // Get followups by report
    getFollowupsByReport: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return await getFollowupsByReportId(input.reportId);
      }),

    // Get followups by staff
    getFollowupsByStaff: protectedProcedure
      .input(z.object({ reportStaffId: z.number() }))
      .query(async ({ input }) => {
        return await getFollowupsByStaffId(input.reportStaffId);
      }),

    // Delete followup
    deleteFollowup: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReportFollowup(input.id);
        return { success: true };
      }),

    // Batch extract followups from recent reports
    batchExtractFollowups: protectedProcedure
      .input(
        z.object({
          days: z.number().default(7),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);

        const reports = await getReportsForAnalysis({
          startDate,
          endDate,
        });

        let totalExtracted = 0;
        let totalCreated = 0;

        for (const { report } of reports) {
          const workContent = report.workContent || "";
          if (!workContent.trim()) continue;

          // Simple keyword-based extraction for batch processing
          const followupKeywords = [
            "提案", "打ち合わせ", "商談", "MTG", "ミーティング",
            "確認", "検討", "相談", "調整", "連絡",
            "合同", "会合", "面談", "訪問",
            "提议", "会议", "商谈", "确认", "讨论"
          ];

          const hasFollowupKeyword = followupKeywords.some(kw => workContent.includes(kw));
          if (!hasFollowupKeyword) continue;

          // Extract sentences containing keywords
          const sentences = workContent.split(/[。\n]/).filter(s => s.trim());
          for (const sentence of sentences) {
            const matchedKeyword = followupKeywords.find(kw => sentence.includes(kw));
            if (matchedKeyword) {
              const item = sentence.trim().substring(0, 100);
              const existing = await checkExistingFollowup(report.id, item);
              if (!existing) {
                let category: "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他" = "その他";
                if (sentence.includes("提案") || sentence.includes("提议")) category = "提案";
                else if (sentence.includes("打ち合わせ") || sentence.includes("会议") || sentence.includes("ミーティング")) category = "打ち合わせ";
                else if (sentence.includes("商談") || sentence.includes("商谈")) category = "商談";
                else if (sentence.includes("MTG")) category = "MTG";
                else if (sentence.includes("確認") || sentence.includes("确认")) category = "確認";

                const reportDate = new Date(report.reportDate);
                const dueDate = new Date(reportDate);
                dueDate.setDate(dueDate.getDate() + 2);

                await createReportFollowup({
                  reportId: report.id,
                  reportStaffId: report.reportStaffId,
                  extractedItem: item,
                  category,
                  status: "pending",
                  dueDate,
                });
                totalCreated++;
              }
              totalExtracted++;
            }
          }
        }

        return {
          success: true,
          reportsProcessed: reports.length,
          totalExtracted,
          totalCreated,
        };
      }),
  }),

  // Brand Management Router
  brand: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          companyName: z.string().optional(),
          category: z.string().optional(),
          phoneNumber: z.string().optional(),
          status: z.enum(["進行中", "打ち合わせ中", "契約済み", "保留", "終了"]).default("進行中"),
          materialCategory: z.string().optional(),
          email: z.string().optional(),
          contactPerson: z.string().optional(),
          adBudget: z.number().optional(),
          salesTarget: z.number().optional(),
          commissionRate: z.string().optional(),
          businessCardUrls: z.array(z.string()).optional(),
          businessCardKeys: z.array(z.string()).optional(),
          logoUrl: z.string().optional(),
          logoKey: z.string().optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const brand = await createBrand({
          ...input,
          createdBy: ctx.user.id,
        });
        
        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "brand_create",
          actionLabel: "ブランドを作成",
          targetId: brand.id,
          targetName: brand.brandName,
        });
        
        return brand;
      }),

    list: protectedProcedure
      .input(
        z.object({
          status: z.string().optional(),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getAllBrands(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getBrandById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          companyName: z.string().optional(),
          category: z.string().optional(),
          phoneNumber: z.string().optional(),
          status: z.enum(["進行中", "打ち合わせ中", "契約済み", "保留", "終了"]).optional(),
          materialCategory: z.string().optional(),
          email: z.string().optional(),
          contactPerson: z.string().optional(),
          adBudget: z.number().optional(),
          salesTarget: z.number().optional(),
          commissionRate: z.string().optional(),
          businessCardUrls: z.array(z.string()).optional(),
          businessCardKeys: z.array(z.string()).optional(),
          logoUrl: z.string().optional(),
          logoKey: z.string().optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        return await updateBrand(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrand(input.id);
        return { success: true };
      }),

    statistics: protectedProcedure.query(async () => {
      return await getBrandStatistics();
    }),

    // Upload image for brand
    uploadImage: protectedProcedure
      .input(
        z.object({
          base64: z.string(),
          filename: z.string(),
          type: z.enum(["logo", "businessCard", "product"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.filename.split(".").pop() || "png";
        const key = `brands/${ctx.user.id}/${input.type}/${nanoid()}.${ext}`;
        const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        
        const { url } = await storagePut(key, buffer, contentType);
        return { url, key };
      }),

    // LCJ Staff Management for Brands
    getLcjStaff: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getBrandLcjStaff(input.brandId);
      }),

    assignLcjStaff: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        reportStaffId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await assignLcjStaffToBrand(input.brandId, input.reportStaffId);
      }),

    removeLcjStaff: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        reportStaffId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await removeLcjStaffFromBrand(input.brandId, input.reportStaffId);
        return { success: true };
      }),

    setLcjStaff: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        reportStaffIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await setBrandLcjStaff(input.brandId, input.reportStaffIds);
        return { success: true };
      }),
  }),

  // Brand Products Router
  brandProduct: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          productName: z.string().min(1),
          listPrice: z.number().optional(),
          specialPrice: z.number().optional(),
          discountRate: z.string().optional(),
          sampleProduct: z.string().optional(),
          productCode: z.string().optional(),
          influencer: z.string().optional(),
          purchasePrice: z.number().optional(),
          remarks: z.string().optional(),
          imageUrls: z.array(z.string()).max(2).optional(), // 最大2枚の商品画像
          imageKeys: z.array(z.string()).max(2).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await createBrandProduct(input);
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getProductsByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          productName: z.string().optional(),
          listPrice: z.number().optional(),
          specialPrice: z.number().optional(),
          discountRate: z.string().optional(),
          sampleProduct: z.string().optional(),
          productCode: z.string().optional(),
          influencer: z.string().optional(),
          purchasePrice: z.number().optional(),
          remarks: z.string().optional(),
          imageUrls: z.array(z.string()).max(2).optional(), // 最大2枚の商品画像
          imageKeys: z.array(z.string()).max(2).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        await updateBrandProduct(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandProduct(input.id);
        return { success: true };
      }),
  }),

  // Brand Activities Router
  brandActivity: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          activityDate: z.string(),
          activityType: z.enum(["進行中", "打ち合わせ", "完了"]).default("進行中"),
          contactPerson: z.string().optional(),
          nextAction: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const activity = await createBrandActivity({
          ...input,
          activityDate: new Date(input.activityDate),
          createdBy: ctx.user.id,
        });
        
        // Get brand name for activity log
        const brand = await getBrandById(input.brandId);
        
        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "brand_activity_create",
          actionLabel: "対応履歴を追加",
          targetId: input.brandId,
          targetName: brand?.name || `ブランド #${input.brandId}`,
        });
        
        return activity;
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getActivitiesByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          activityDate: z.string().optional(),
          activityType: z.enum(["進行中", "打ち合わせ", "完了"]).optional(),
          contactPerson: z.string().optional(),
          nextAction: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, activityDate, ...rest } = input;
        const updateData: any = { ...rest };
        if (activityDate) {
          updateData.activityDate = new Date(activityDate);
        }
        await updateBrandActivity(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandActivity(input.id);
        return { success: true };
      }),
  }),

  // Brand Livestream Router (直播履歴)
  brandLivestream: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          livestreamDate: z.string(),
          streamerName: z.string().min(1),
          salesAmount: z.number().optional(),
          duration: z.number().optional(),
          viewerCount: z.number().optional(),
          orderCount: z.number().optional(),
          platform: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createBrandLivestream({
          ...input,
          livestreamDate: new Date(input.livestreamDate),
          createdBy: ctx.user.id,
        });
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamsByBrandId(input.brandId);
      }),

    stats: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamStatsByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          livestreamDate: z.string().optional(),
          streamerName: z.string().optional(),
          salesAmount: z.number().optional(),
          duration: z.number().optional(),
          viewerCount: z.number().optional(),
          orderCount: z.number().optional(),
          platform: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, livestreamDate, ...rest } = input;
        const updateData: any = { ...rest };
        if (livestreamDate) {
          updateData.livestreamDate = new Date(livestreamDate);
        }
        await updateBrandLivestream(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandLivestream(input.id);
        return { success: true };
      }),
  }),

  // Business Card Management Router
  businessCard: router({
    // Upload and OCR a business card image
    upload: protectedProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Upload image to S3
          const imageBuffer = Buffer.from(input.imageBase64, "base64");
          const fileKey = `business-cards/${ctx.user.id}/${nanoid()}.${input.mimeType.split("/")[1] || "jpg"}`;
          const { url: imageUrl, key: imageKey } = await storagePut(fileKey, imageBuffer, input.mimeType);

          // Use LLM to extract business card information
          const ocrResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a business card OCR assistant. Extract all information from the business card image and return it in JSON format.
Extract the following fields if available:
- name: Full name (氏名)
- nameReading: Name reading/pronunciation (読み仮名) if visible
- company: Company name (会社名)
- department: Department (部署)
- position: Job title/position (役職)
- email: Email address
- phone: Phone number (電話番号)
- mobile: Mobile phone (携帯電話)
- fax: Fax number
- address: Full address (住所)
- website: Website URL

Return ONLY valid JSON, no markdown or explanation.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
                {
                  type: "text",
                  text: "Please extract all business card information from this image.",
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "business_card_info",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name" },
                  nameReading: { type: "string", description: "Name reading" },
                  company: { type: "string", description: "Company name" },
                  department: { type: "string", description: "Department" },
                  position: { type: "string", description: "Job title" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" },
                  mobile: { type: "string", description: "Mobile phone" },
                  fax: { type: "string", description: "Fax number" },
                  address: { type: "string", description: "Address" },
                  website: { type: "string", description: "Website URL" },
                },
                required: ["name"],
                additionalProperties: false,
              },
            },
          },
        });

        let extractedInfo: any = {};
        try {
          const content = ocrResult.choices[0]?.message?.content;
          if (content && typeof content === 'string') {
            extractedInfo = JSON.parse(content);
          }
        } catch (e) {
          console.error("Failed to parse OCR result:", e);
        }

        return {
          imageUrl,
          imageKey,
          extractedInfo,
        };
      } catch (error) {
        console.error("Business card upload/OCR error:", error);
        throw new Error("名刺の解析に失敗しました。画像を確認して再試行してください。");
      }
    }),

    // Create a new business card
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          nameReading: z.string().optional(),
          company: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          mobile: z.string().optional(),
          fax: z.string().optional(),
          address: z.string().optional(),
          website: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          notes: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Generate duplicate hash from company + name
        const crypto = await import("crypto");
        const duplicateHash = crypto
          .createHash("md5")
          .update(`${input.company || ""}|${input.name}`)
          .digest("hex");

        // Check for duplicates
        const existing = await checkDuplicateBusinessCard(duplicateHash);
        if (existing) {
          return {
            success: false,
            duplicate: true,
            existingCard: existing,
            message: "A business card with the same name and company already exists.",
          };
        }

        await createBusinessCard({
          ...input,
          registeredBy: ctx.user.id,
          duplicateHash,
        });

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "business_card_create",
          actionLabel: "名刺を登録",
          targetType: "business_card",
          targetName: `${input.name}${input.company ? ` (${input.company})` : ""}`,
          metadata: {
            company: input.company,
            position: input.position,
            email: input.email,
          },
        });

        return { success: true, duplicate: false };
      }),

    // Get all business cards
    list: protectedProcedure
      .input(
        z.object({
          search: z.string().optional(),
          registeredBy: z.number().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getBusinessCards(input);
      }),

    // Get business card by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getBusinessCardById(input.id);
      }),

    // Update business card
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          nameReading: z.string().optional(),
          company: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          mobile: z.string().optional(),
          fax: z.string().optional(),
          address: z.string().optional(),
          website: z.string().optional(),
          notes: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        
        // If name or company changed, update duplicate hash
        if (data.name || data.company) {
          const existing = await getBusinessCardById(id);
          if (existing) {
            const crypto = await import("crypto");
            const newHash = crypto
              .createHash("md5")
              .update(`${data.company || existing.company || ""}|${data.name || existing.name}`)
              .digest("hex");
            (data as any).duplicateHash = newHash;
          }
        }
        
        await updateBusinessCard(id, data);
        return { success: true };
      }),

    // Delete business card
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBusinessCard(input.id);
        return { success: true };
      }),

    // Get count
    count: protectedProcedure
      .input(z.object({ registeredBy: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getBusinessCardCount(input?.registeredBy);
      }),

    // Check for duplicate
    checkDuplicate: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          company: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const crypto = await import("crypto");
        const duplicateHash = crypto
          .createHash("md5")
          .update(`${input.company || ""}|${input.name}`)
          .digest("hex");
        
        const existing = await checkDuplicateBusinessCard(duplicateHash);
        return {
          isDuplicate: !!existing,
          existingCard: existing,
        };
      }),
  }),

  // Activity Log Router
  activityLog: router({
    // Get recent activity logs
    getRecent: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getRecentActivityLogs(input?.limit || 50);
      }),

    // Get activity logs by user
    getByUser: protectedProcedure
      .input(z.object({ userId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getActivityLogsByUser(input.userId, input.limit || 50);
      }),
  }),

  // User Management Router (for admin)
  users: router({
    // Get all registered users
    getAll: protectedProcedure.query(async () => {
      return await getAllUsers();
    }),

    // Get user activity statistics
    getActivityStats: protectedProcedure.query(async () => {
      return await getUserActivityStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
