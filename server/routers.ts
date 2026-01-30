import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { sendCoachingToLiver } from "./_core/lineMessaging";
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
  getProductsByBrandIdWithGmv,
  getBrandProductById,
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
  createBrandContract,
  getContractsByBrandId,
  getContractById,
  updateBrandContract,
  deleteBrandContract,
  getActiveContractsCount,
  getAllContracts,
  createReportAiAdvice,
  getAiAdviceByReportId,
  getAiAdviceById,
  createAiAdviceFeedback,
  getFeedbackByAdviceId,
  getUserFeedbackForAdvice,
  updateAiAdviceFeedback,
  upsertAiLearningExample,
  getGoodLearningExamples,
  getBadLearningExamples,
  getAiFeedbackStats,
  createChatReportSession,
  getChatSessionById,
  getTodayChatSession,
  getChatSessionsByStaffId,
  updateChatSessionStatus,
  addChatMessage,
  getMessagesBySessionId,
  getUserMessagesFromSession,
  getOrCreateStaffAiProfile,
  updateStaffAiProfile,
  incrementStaffChatCount,
  updateStaffFeedbackCounts,
  getQuestionTemplatesForDay,
  getAllActiveQuestionTemplates,
  createQuestionTemplate,
  incrementQuestionUsage,
  updateQuestionFeedback,
  getRecentReportsByStaffId,
  getAllLineUsers,
  getAllLineGroups,
  getLineUsersWithLiverDetails,
  getLiverInteractionSummary,
  getLineMessages,
  saveLineMessage,
  createLineFollowUp,
  getActiveLineFollowUps,
  updateLineFollowUpStatus,
  getAllLineFollowUps,
  updateLineGroupAutoFollowUp,
  getPendingResponsesForUI,
  cancelPendingResponse,
  markMessageResponded,
  createSchedule,
  getScheduleById,
  getSchedulesByDate,
  getSchedulesByDateRange,
  getSchedulesByLiverName,
  updateSchedule,
  deleteSchedule,
  getUpcomingSchedules,
  createLiver,
  getLiverByEmail,
  getLiverById,
  getAllActiveLivers,
  getAllLivers,
  updateLiver,
  updateLiverLastLogin,
  checkLiverEmailExists,
  getSchedulesByLiverId,
  createLivestreamProduct,
  getLivestreamProductsByLivestreamId,
  updateLivestreamProduct,
  deleteLivestreamProduct,
  getLivestreamProductsTotalGmv,
  deleteLivestreamProductsByLivestreamId,
  getMonthlyGmvSummary,
  createBrandMemo,
  getMemosByBrandId,
  deleteBrandMemo,
  updateBrandMemo,
  createContractLivestreamLink,
  getContractLivestreamLinks,
  getContractLinkedLivestreams,
  deleteContractLivestreamLink,
  deleteAllContractLivestreamLinks,
  checkContractLivestreamLinkExists,
  calculateContractRoas,
  getLivestreamsByLiverId,
  getLiverStatistics,
  getLiverRankings,
  getLivestreamById,
  updateLivestreamResult,
  getLiversWithStats,
  createBrandEditLog,
  getBrandEditLogs,
  logBrandEdit,
  getProductImages,
  addProductImage,
  deleteProductImage,
  reorderProductImages,
  getBrandFiles,
  createBrandFile,
  deleteBrandFile,
  getBrandFileById,
  getProductLinks,
  addProductLink,
  updateProductLink,
  deleteProductLink,
  getProductLinksForProducts,
  getAllLivestreams,
  getAllProducts,
  findExistingLivestream,
  updateLivestreamFromCsv,
  createLivestreamFromCsv,
  getCsvImportedLivestreams,
  importLivestreamProductsFromCsv,
  createCsvImportHistory,
  getCsvImportHistoryByLivestream,
  deleteCsvImportHistory,
  createLivestreamCsvImportHistory,
  getLivestreamCsvImportHistoryByLiver,
  deleteLivestreamCsvImportHistory,
} from "./db";
import { pushMessage, leaveGroup } from "./line";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { lineUsers, brands, lineGroups, schedules } from "../drizzle/schema";
import { eq, and, not, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authRouter } from "./auth";
import { liverRouter } from "./liverRouter";
import { checkAndSendReminders } from "./reminderScheduler";
import { completionRouter } from "./completion";
import { sendReminderEmail } from "./emailService";
import { transcribeAudio } from "./_core/voiceTranscription";

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
          nameJa: z.string().min(1),
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
          nameJa: z.string().optional(),
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

    // Generate AI advertising proposal for a brand
    generateAdProposal: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .mutation(async ({ input }) => {
        // Get brand data
        const brand = await getBrandById(input.brandId);
        if (!brand) {
          throw new Error("Brand not found");
        }

        // Get contracts for the brand
        const contracts = await getContractsByBrandId(input.brandId);
        
        // Get livestreams for the brand
        const livestreams = await getLivestreamsByBrandId(input.brandId);
        
        // Get products for the brand
        const products = await getProductsByBrandId(input.brandId);

        // Calculate key metrics
        const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.salesAmount || 0), 0);
        const totalAdCost = livestreams.reduce((sum, ls) => sum + (ls.adCost || 0), 0);
        const avgRoas = totalAdCost > 0 ? totalGmv / totalAdCost : 0;
        const totalLivestreams = livestreams.length;
        const avgSalesPerLive = totalLivestreams > 0 ? totalGmv / totalLivestreams : 0;
        
        // Get top products by GMV from all livestreams
        const productGmvMap = new Map<string, number>();
        for (const ls of livestreams) {
          // Get products for this livestream
          const lsProducts = await getLivestreamProductsByLivestreamId(ls.id);
          for (const p of lsProducts) {
            const current = productGmvMap.get(p.productName) || 0;
            productGmvMap.set(p.productName, current + (p.directGmv || p.gmv || 0));
          }
        }
        const topProducts = Array.from(productGmvMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, gmv]) => ({ name, gmv }));

        // Calculate average duration and best performing time slots
        const avgDuration = totalLivestreams > 0 
          ? livestreams.reduce((sum, ls) => sum + (ls.duration || 0), 0) / totalLivestreams 
          : 0;

        // Get contract info
        const activeContracts = contracts.filter(c => c.status === '契約中');
        const totalContractValue = activeContracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0);

        // Build prompt for AI
        const prompt = `あなたはTikTokライブコマースの広告戦略コンサルタントです。以下のブランドデータを分析し、具体的な広告提案を作成してください。

## ブランド情報
- ブランド名: ${brand.name} (${brand.nameJa || ''})
- カテゴリー: ${brand.category || '未設定'}
- ステータス: ${brand.status || '未設定'}

## 実績データ
- 総GMV: ¥${totalGmv.toLocaleString()}
- 総広告費: ¥${totalAdCost.toLocaleString()}
- 平均ROAS: ${avgRoas.toFixed(2)}倍
- 配信回数: ${totalLivestreams}回
- 平均売上/配信: ¥${Math.round(avgSalesPerLive).toLocaleString()}
- 平均配信時間: ${Math.round(avgDuration)}分

## 売れ筋商品TOP5
${topProducts.map((p, i) => `${i + 1}. ${p.name}: ¥${p.gmv.toLocaleString()}`).join('\n')}

## 契約情報
- アクティブ契約数: ${activeContracts.length}件
- 契約総額: ¥${totalContractValue.toLocaleString()}

## 商品数
- 登録商品数: ${products.length}点

---

上記のデータを分析し、以下の形式で広告提案を作成してください：

1. **現状分析** (約200字)
   - ROASの評価（業界平均との比較）
   - 強みと課題

2. **推奨広告戦略** (約300字)
   - 推奨広告予算（具体的な金額）
   - 推奨配信頻度
   - ターゲット層の提案
   - 推奨商品選定

3. **アクションプラン** (約200字)
   - 短期（1ヶ月）の具体的なアクション
   - 中期（3ヶ月）の目標
   - 期待されるROAS改善率

日本語で回答してください。具体的な数字を含めてください。`;

        // Call LLM
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "あなたはTikTokライブコマースの広告戦略コンサルタントです。データに基づいた具体的で実行可能な広告提案を作成してください。" },
            { role: "user", content: prompt },
          ],
        });

        const proposalContent = response.choices[0]?.message?.content || "提案を生成できませんでした";

        return {
          brandId: input.brandId,
          brandName: brand.name,
          proposal: proposalContent,
          metrics: {
            totalGmv,
            totalAdCost,
            avgRoas,
            totalLivestreams,
            avgSalesPerLive,
            avgDuration,
            topProducts,
            activeContractsCount: activeContracts.length,
            totalContractValue,
            productsCount: products.length,
          },
          generatedAt: new Date().toISOString(),
        };
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

    // Get edit logs for a brand
    getEditLogs: protectedProcedure
      .input(z.object({ 
        brandId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getBrandEditLogs(input.brandId, input.limit || 50);
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
          proposalImageUrl: z.string().optional(), // 提案書画像URL
          proposalImageKey: z.string().optional(), // 提案書画像S3 key
          commissionRate: z.string().optional(), // 成果報酬
          // AI抽出情報フィールド
          releaseDate: z.string().optional(),
          catchCopy: z.string().optional(),
          features: z.string().optional(),
          productDetails: z.string().optional(),
          accessories: z.string().optional(),
          shippingInfo: z.string().optional(),
          targetAudience: z.string().optional(),
          usageMethod: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const product = await createBrandProduct(input);
        
        // Record edit log
        await logBrandEdit(
          input.brandId,
          "create",
          "product",
          product.id,
          input.productName,
          `商品を追加：${input.productName}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );
        
        return product;
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getProductsByBrandIdWithGmv(input.brandId);
      }),

    listAll: protectedProcedure
      .query(async () => {
        return await getAllProducts();
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
          // AI抽出情報フィールド
          commissionRate: z.string().optional(),
          releaseDate: z.string().optional(),
          catchCopy: z.string().optional(),
          features: z.string().optional(),
          productDetails: z.string().optional(),
          accessories: z.string().optional(),
          shippingInfo: z.string().optional(),
          targetAudience: z.string().optional(),
          usageMethod: z.string().optional(),
          createdAt: z.string().optional(), // 登録日の編集用
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[brandProduct.update] Input received:", JSON.stringify(input, null, 2));
          const { id, createdAt, ...updateData } = input;
          
          // Get existing product for logging
          const existingProduct = await getBrandProductById(id);
          
          // createdAtが指定されている場合は変換して追加
          const finalUpdateData = createdAt 
            ? { ...updateData, createdAt: new Date(createdAt) }
            : updateData;
          console.log("[brandProduct.update] Final update data:", JSON.stringify(finalUpdateData, null, 2));
          await updateBrandProduct(id, finalUpdateData);
          console.log("[brandProduct.update] Success for id:", id);
          
          // Record edit log with detailed changes
          if (existingProduct) {
            // Build detailed change description
            const changes: string[] = [];
            if (updateData.productName && updateData.productName !== existingProduct.productName) {
              changes.push(`商品名: ${existingProduct.productName} → ${updateData.productName}`);
            }
            if (updateData.listPrice !== undefined && updateData.listPrice !== existingProduct.listPrice) {
              changes.push(`定価: ¥${existingProduct.listPrice?.toLocaleString() || 0} → ¥${updateData.listPrice.toLocaleString()}`);
            }
            if (updateData.specialPrice !== undefined && updateData.specialPrice !== existingProduct.specialPrice) {
              changes.push(`特別価格: ¥${existingProduct.specialPrice?.toLocaleString() || 0} → ¥${updateData.specialPrice.toLocaleString()}`);
            }
            if (updateData.commissionRate !== undefined && updateData.commissionRate !== existingProduct.commissionRate) {
              changes.push(`成果報酬: ${existingProduct.commissionRate || '-'}% → ${updateData.commissionRate}%`);
            }
            if (updateData.discountRate !== undefined && updateData.discountRate !== existingProduct.discountRate) {
              changes.push(`仕切率: ${existingProduct.discountRate || '-'} → ${updateData.discountRate}`);
            }
            if (updateData.purchasePrice !== undefined && updateData.purchasePrice !== existingProduct.purchasePrice) {
              changes.push(`仕入金額: ¥${existingProduct.purchasePrice?.toLocaleString() || 0} → ¥${updateData.purchasePrice.toLocaleString()}`);
            }
            if (updateData.remarks !== undefined && updateData.remarks !== existingProduct.remarks) {
              changes.push(`備考を更新`);
            }
            
            const changeDescription = changes.length > 0 
              ? `商品を編集：${existingProduct.productName}\n${changes.join('\n')}`
              : `商品を編集：${existingProduct.productName}`;
            
            await logBrandEdit(
              existingProduct.brandId,
              "update",
              "product",
              id,
              existingProduct.productName,
              changeDescription,
              ctx.user.id,
              ctx.user.name || ctx.user.email,
              JSON.stringify(existingProduct),
              JSON.stringify({ ...existingProduct, ...finalUpdateData })
            );
          }
          
          return { success: true };
        } catch (error) {
          console.error("[brandProduct.update] Error:", error);
          throw error;
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing product for logging
        const existingProduct = await getBrandProductById(input.id);
        
        await deleteBrandProduct(input.id);
        
        // Record edit log
        if (existingProduct) {
          await logBrandEdit(
            existingProduct.brandId,
            "delete",
            "product",
            input.id,
            existingProduct.productName,
            `商品を削除：${existingProduct.productName}`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }
        
        return { success: true };
      }),

    // AI画像解析による商品情報抽出
    extractFromImage: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string(), // S3にアップロードされた提案書画像のURL
        })
      )
      .mutation(async ({ input }) => {
        const systemPrompt = `あなたは商品提案書から情報を抽出する専門家です。
提案書画像から以下の情報をできるだけ詳細に抽出してください。日本語・中国語のテキストを正確に読み取ってください。

抽出する情報：
- productName: 商品名（必須、ブランド名も含む）
- listPrice: 公式価格・定価（数値のみ、円記号なし）
- specialPrice: ライブ価格・特別価格（数値のみ、円記号なし）
- discountRate: 割引率（例: "20%"）
- releaseDate: 発売日（YYYY年MM月形式でも可）
- stock: 在庫数（数値のみ）
- productCode: 商品ID・コード品番
- catchCopy: キャッチコピー・商品の特徴を表すフレーズ
- features: 商品の特徴・セールスポイント（箇条書きで複数あれば改行区切り）
- productDetails: 商品詳細（内容量、容量、カプセル数、生産ロット、使用期限など）
- accessories: 付属品・セット内容
- shippingInfo: 配送情報（配送方法、配送期間、送料など）
- commissionRate: 成果報酬・手数料率（例: "15%"）
- targetAudience: ターゲット層・対象者
- usageMethod: 使用方法・使い方
- remarks: その他の備考・注意事項

画像内のすべてのテキストを注意深く読み取り、該当するフィールドに割り当ててください。
画像から読み取れない情報は空文字列としてください。`;

        try {
          console.log("[AI Product Extract] Starting extraction for image:", input.imageUrl);
          
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "この提案書画像から商品情報を抽出してください。",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: input.imageUrl,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "product_info",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    productName: { type: "string", description: "商品名（不明な場合は空文字列）" },
                    listPrice: { type: "number", description: "公式価格・定価（不明な場合は0）" },
                    specialPrice: { type: "number", description: "ライブ価格・特別価格（不明な場合は0）" },
                    discountRate: { type: "string", description: "割引率（不明な場合は空文字列）" },
                    releaseDate: { type: "string", description: "発売日（不明な場合は空文字列）" },
                    stock: { type: "number", description: "在庫数（不明な場合は0）" },
                    productCode: { type: "string", description: "商品ID・コード品番（不明な場合は空文字列）" },
                    catchCopy: { type: "string", description: "キャッチコピー・特徴（不明な場合は空文字列）" },
                    features: { type: "string", description: "商品の特徴・セールスポイント（不明な場合は空文字列）" },
                    productDetails: { type: "string", description: "商品詳細（不明な場合は空文字列）" },
                    accessories: { type: "string", description: "付属品・セット内容（不明な場合は空文字列）" },
                    shippingInfo: { type: "string", description: "配送情報（不明な場合は空文字列）" },
                    commissionRate: { type: "string", description: "成果報酬・手数料率（不明な場合は空文字列）" },
                    targetAudience: { type: "string", description: "ターゲット層・対象者（不明な場合は空文字列）" },
                    usageMethod: { type: "string", description: "使用方法・使い方（不明な場合は空文字列）" },
                    remarks: { type: "string", description: "その他の備考（不明な場合は空文字列）" },
                  },
                  required: [
                    "productName",
                    "listPrice",
                    "specialPrice",
                    "discountRate",
                    "releaseDate",
                    "stock",
                    "productCode",
                    "catchCopy",
                    "features",
                    "productDetails",
                    "accessories",
                    "shippingInfo",
                    "commissionRate",
                    "targetAudience",
                    "usageMethod",
                    "remarks",
                  ],
                  additionalProperties: false,
                },
              },
            },
          });

          console.log("[AI Product Extract] LLM response received");

          const content = response.choices[0]?.message?.content;
          if (!content || typeof content !== "string") {
            console.error("[AI Product Extract] No content in response:", response);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "AI解析に失敗しました（レスポンスが空）",
            });
          }

          console.log("[AI Product Extract] Parsing content:", content.substring(0, 200));
          const extractedData = JSON.parse(content);
          console.log("[AI Product Extract] Extraction successful:", extractedData.productName);
          
          return {
            success: true,
            data: extractedData,
          };
        } catch (e: any) {
          console.error("[AI Product Extract] Error:", e.message || e);
          if (e instanceof TRPCError) {
            throw e;
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `AI解析に失敗しました: ${e.message || "不明なエラー"}`,
          });
        }
      }),

    // Product Images APIs
    getImages: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await getProductImages(input.productId);
      }),

    addImage: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          imageUrl: z.string(),
          imageKey: z.string(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await addProductImage({
          productId: input.productId,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          sortOrder: input.sortOrder,
          createdBy: ctx.user.id,
        });
      }),

    deleteImage: protectedProcedure
      .input(z.object({ imageId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteProductImage(input.imageId);
      }),

    reorderImages: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          imageIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        return await reorderProductImages(input.productId, input.imageIds);
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
          // 追加メトリクスフィールド
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          salesCount: z.number().optional(),
          gmv: z.number().optional(),
          cartAddCount: z.number().optional(),
          // 商品紐付けフィールド
          productId: z.number().optional(),
          productCommission: z.string().optional(),
          adCost: z.number().optional(),
          ctr: z.string().optional(),
          cvr: z.string().optional(),
          cpc: z.number().optional(),
          acos: z.string().optional(),
          roas: z.string().optional(),
          livestreamStartTime: z.string().optional(), // ライブ開始時間 (e.g., "14:30")
        })
      )
      .mutation(async ({ ctx, input }) => {
        const livestream = await createBrandLivestream({
          ...input,
          livestreamDate: new Date(input.livestreamDate),
          createdBy: ctx.user.id,
        });
        
        // Record edit log
        const dateStr = new Date(input.livestreamDate).toLocaleDateString('ja-JP');
        await logBrandEdit(
          input.brandId,
          "create",
          "livestream",
          livestream.id,
          `${dateStr} ${input.streamerName}`,
          `ライブ配信を追加：${dateStr} ${input.streamerName}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );
        
        return livestream;
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamsByBrandId(input.brandId);
      }),

    listAll: protectedProcedure
      .query(async () => {
        return await getAllLivestreams();
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
          // 追加メトリクスフィールド
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          salesCount: z.number().optional(),
          gmv: z.number().optional(),
          cartAddCount: z.number().optional(),
          // 商品紐付けフィールド
          productId: z.number().nullable().optional(),
          productCommission: z.string().optional(),
          adCost: z.number().optional(),
          ctr: z.string().optional(),
          cvr: z.string().optional(),
          cpc: z.number().optional(),
          acos: z.string().optional(),
          roas: z.string().optional(),
          livestreamStartTime: z.string().optional(), // ライブ開始時間 (e.g., "14:30")
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, livestreamDate, ...rest } = input;
        
        // Get existing livestream for logging
        const existingLivestream = await getLivestreamById(id);
        
        const updateData: any = { ...rest };
        if (livestreamDate) {
          updateData.livestreamDate = new Date(livestreamDate);
        }
        await updateBrandLivestream(id, updateData);
        
        // Record edit log with detailed changes
        if (existingLivestream) {
          const dateStr = existingLivestream.livestreamDate 
            ? new Date(existingLivestream.livestreamDate).toLocaleDateString('ja-JP')
            : '不明';
          
          // Build detailed change description
          const changes: string[] = [];
          if (rest.streamerName && rest.streamerName !== existingLivestream.streamerName) {
            changes.push(`アカウント: ${existingLivestream.streamerName} → ${rest.streamerName}`);
          }
          if (rest.gmv !== undefined && rest.gmv !== existingLivestream.gmv) {
            changes.push(`GMV: ¥${existingLivestream.gmv?.toLocaleString() || 0} → ¥${rest.gmv.toLocaleString()}`);
          }
          if (rest.impressions !== undefined && rest.impressions !== existingLivestream.impressions) {
            changes.push(`曝光: ${existingLivestream.impressions?.toLocaleString() || 0} → ${rest.impressions.toLocaleString()}`);
          }
          if (rest.salesCount !== undefined && rest.salesCount !== existingLivestream.salesCount) {
            changes.push(`販売件数: ${existingLivestream.salesCount?.toLocaleString() || 0} → ${rest.salesCount.toLocaleString()}`);
          }
          if (rest.productClicks !== undefined && rest.productClicks !== existingLivestream.productClicks) {
            changes.push(`商品クリック: ${existingLivestream.productClicks?.toLocaleString() || 0} → ${rest.productClicks.toLocaleString()}`);
          }
          if (rest.cartAddCount !== undefined && rest.cartAddCount !== existingLivestream.cartAddCount) {
            changes.push(`カート追加: ${existingLivestream.cartAddCount?.toLocaleString() || 0} → ${rest.cartAddCount.toLocaleString()}`);
          }
          if (rest.duration !== undefined && rest.duration !== existingLivestream.duration) {
            changes.push(`時間: ${existingLivestream.duration || 0}分 → ${rest.duration}分`);
          }
          if (rest.platform && rest.platform !== existingLivestream.platform) {
            changes.push(`プラットフォーム: ${existingLivestream.platform || '-'} → ${rest.platform}`);
          }
          if (rest.productCommission !== undefined && rest.productCommission !== existingLivestream.productCommission) {
            changes.push(`手数料: ${existingLivestream.productCommission || '-'}% → ${rest.productCommission}%`);
          }
          
          const changeDescription = changes.length > 0 
            ? `ライブ配信を編集：${dateStr} ${existingLivestream.streamerName}\n${changes.join('\n')}`
            : `ライブ配信を編集：${dateStr} ${existingLivestream.streamerName}`;
          
          await logBrandEdit(
            existingLivestream.brandId,
            "update",
            "livestream",
            id,
            `${dateStr} ${existingLivestream.streamerName}`,
            changeDescription,
            ctx.user.id,
            ctx.user.name || ctx.user.email,
            JSON.stringify(existingLivestream),
            JSON.stringify({ ...existingLivestream, ...updateData })
          );
        }
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing livestream for logging
        const existingLivestream = await getLivestreamById(input.id);
        
        // 商品別GMVも削除
        await deleteLivestreamProductsByLivestreamId(input.id);
        await deleteBrandLivestream(input.id);
        
        // Record edit log
        if (existingLivestream) {
          const dateStr = existingLivestream.livestreamDate 
            ? new Date(existingLivestream.livestreamDate).toLocaleDateString('ja-JP')
            : '不明';
          await logBrandEdit(
            existingLivestream.brandId,
            "delete",
            "livestream",
            input.id,
            `${dateStr} ${existingLivestream.streamerName}`,
            `ライブ配信を削除：${dateStr} ${existingLivestream.streamerName}`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }
        
        return { success: true };
      }),

    // 商品別GMV操作
    addProduct: protectedProcedure
      .input(
        z.object({
          livestreamId: z.number(),
          productName: z.string().min(1),
          gmv: z.number().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          cartAddCount: z.number().optional(),
          conversionRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await createLivestreamProduct(input);
      }),

    listProducts: protectedProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamProductsByLivestreamId(input.livestreamId);
      }),

    updateProduct: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          productName: z.string().optional(),
          gmv: z.number().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          cartAddCount: z.number().optional(),
          conversionRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateLivestreamProduct(id, data);
        return { success: true };
      }),

    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLivestreamProduct(input.id);
        return { success: true };
      }),

    getProductsTotalGmv: protectedProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamProductsTotalGmv(input.livestreamId);
      }),

    // 月別GMV集計を取得
    monthlyGmvSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getMonthlyGmvSummary(input.brandId);
      }),

    // 商品別CSVインポート（TikTok Creator-Live-Recap-Product-List形式）
    importProductCsv: protectedProcedure
      .input(
        z.object({
          livestreamId: z.number(),
          fileName: z.string().optional(),
          products: z.array(
            z.object({
              productName: z.string(),
              grossRevenue: z.number().optional().nullable(),
              directGmv: z.number().optional().nullable(),
              itemsSold: z.number().optional().nullable(),
              customers: z.number().optional().nullable(),
              orders: z.number().optional().nullable(),
              ctr: z.string().optional().nullable(),
              ctor: z.string().optional().nullable(),
              productImpressions: z.number().optional().nullable(),
              productClicks: z.number().optional().nullable(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const count = await importLivestreamProductsFromCsv(
          input.livestreamId,
          input.products
        );
        
        // Calculate total GMV
        const totalGmv = input.products.reduce((sum, p) => sum + (p.directGmv || 0), 0);
        
        // Create import history record
        await createCsvImportHistory({
          livestreamId: input.livestreamId,
          fileName: input.fileName || 'unknown.xlsx',
          productCount: count,
          totalGmv,
          importedBy: ctx.user.id,
          importedByName: ctx.user.name || ctx.user.email,
        });
        
        return { success: true, importedCount: count };
      }),
    
    // Get CSV import history for a livestream
    getImportHistory: protectedProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getCsvImportHistoryByLivestream(input.livestreamId);
      }),
    
    // Delete CSV import history and associated products
    deleteImportHistory: protectedProcedure
      .input(z.object({ historyId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteCsvImportHistory(input.historyId);
      }),
  }),

  // Brand Memo Router
  brandMemo: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          content: z.string().min(1),
          authorName: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createBrandMemo({
          ...input,
          createdBy: ctx.user.id,
        });
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getMemosByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const { id, content } = input;
        await updateBrandMemo(id, { content });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandMemo(input.id);
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

  // Brand Contract Router (契約管理)
  brandContract: router({
    // Create a new contract
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          serviceType: z.enum(["TSP", "ライブコマース", "広告運用代行", "SNS運用代行", "その他", "単発ライブ契約", "期間契約", "運用代行型（TSP）", "パッケージ／複合契約"]).default("単発ライブ契約"),
          fixedFee: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          status: z.enum(["契約中", "完了", "保留", "終了"]).default("契約中"),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const contract = await createBrandContract({
          ...input,
          createdBy: ctx.user.id,
        });

        // Get brand name for activity log
        const brand = await getBrandById(input.brandId);

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "brand_contract_create",
          actionLabel: "契約を追加",
          targetId: input.brandId,
          targetName: brand?.name || `ブランド #${input.brandId}`,
          metadata: {
            serviceType: input.serviceType,
            fixedFee: input.fixedFee,
          },
        });
        
        // Record edit log
        const feeStr = input.fixedFee ? `¥${input.fixedFee.toLocaleString()}` : '未設定';
        await logBrandEdit(
          input.brandId,
          "create",
          "contract",
          contract.id,
          `${input.serviceType} ${feeStr}`,
          `契約を追加：${input.serviceType} ${feeStr}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );

        return { ...contract, contractId: contract.id };
      }),

    // Get contracts by brand ID
    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getContractsByBrandId(input.brandId);
      }),

    // Get contract by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getContractById(input.id);
      }),

    // Update a contract
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          serviceType: z.enum(["TSP", "ライブコマース", "広告運用代行", "SNS運用代行", "その他", "単発ライブ契約", "期間契約", "運用代行型（TSP）", "パッケージ／複合契約"]).optional(),
          contractType: z.enum(["月額契約", "年間契約", "単発契約", "広告案件", "その他"]).optional(),
          fixedFee: z.number().optional(),
          commissionRate: z.string().optional(),
          startDate: z.union([z.date(), z.string()]).optional(),
          endDate: z.union([z.date(), z.string()]).optional(),
          status: z.enum(["契約中", "完了", "保留", "終了"]).optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[brandContract.update] Input received:", JSON.stringify(input, null, 2));
          const { id, startDate, endDate, ...rest } = input;
          
          // Get existing contract for logging
          const existingContract = await getContractById(id);
          
          const data: any = { ...rest };
          // 日付を適切に変換
          if (startDate) {
            data.startDate = startDate instanceof Date ? startDate : new Date(startDate);
          }
          if (endDate) {
            data.endDate = endDate instanceof Date ? endDate : new Date(endDate);
          }
          console.log("[brandContract.update] Final data:", JSON.stringify(data, null, 2));
          await updateBrandContract(id, data);
          console.log("[brandContract.update] Success for id:", id);
          
          // Record edit log with detailed changes
          if (existingContract) {
            const feeStr = existingContract.fixedFee ? `¥${existingContract.fixedFee.toLocaleString()}` : '未設定';
            
            // Build detailed change description
            const changes: string[] = [];
            if (rest.serviceType && rest.serviceType !== existingContract.serviceType) {
              changes.push(`契約タイプ: ${existingContract.serviceType} → ${rest.serviceType}`);
            }
            if (rest.fixedFee !== undefined && rest.fixedFee !== existingContract.fixedFee) {
              changes.push(`固定費: ¥${existingContract.fixedFee?.toLocaleString() || 0} → ¥${rest.fixedFee.toLocaleString()}`);
            }
            if (rest.commissionRate !== undefined && rest.commissionRate !== existingContract.commissionRate) {
              changes.push(`成果報酬: ${existingContract.commissionRate || '-'}% → ${rest.commissionRate}%`);
            }
            if (rest.status && rest.status !== existingContract.status) {
              changes.push(`ステータス: ${existingContract.status} → ${rest.status}`);
            }
            if (data.startDate && existingContract.startDate) {
              const oldDate = new Date(existingContract.startDate).toLocaleDateString('ja-JP');
              const newDate = new Date(data.startDate).toLocaleDateString('ja-JP');
              if (oldDate !== newDate) {
                changes.push(`開始日: ${oldDate} → ${newDate}`);
              }
            }
            if (data.endDate && existingContract.endDate) {
              const oldDate = new Date(existingContract.endDate).toLocaleDateString('ja-JP');
              const newDate = new Date(data.endDate).toLocaleDateString('ja-JP');
              if (oldDate !== newDate) {
                changes.push(`終了日: ${oldDate} → ${newDate}`);
              }
            }
            if (rest.memo !== undefined && rest.memo !== existingContract.memo) {
              changes.push(`メモを更新`);
            }
            
            const changeDescription = changes.length > 0 
              ? `契約を編集：${existingContract.serviceType} ${feeStr}\n${changes.join('\n')}`
              : `契約を編集：${existingContract.serviceType} ${feeStr}`;
            
            await logBrandEdit(
              existingContract.brandId,
              "update",
              "contract",
              id,
              `${existingContract.serviceType} ${feeStr}`,
              changeDescription,
              ctx.user.id,
              ctx.user.name || ctx.user.email,
              JSON.stringify(existingContract),
              JSON.stringify({ ...existingContract, ...data })
            );
          }
          
          return { success: true };
        } catch (error) {
          console.error("[brandContract.update] Error:", error);
          throw error;
        }
      }),

    // Delete a contract
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing contract for logging
        const existingContract = await getContractById(input.id);
        
        await deleteBrandContract(input.id);
        
        // Record edit log
        if (existingContract) {
          const feeStr = existingContract.fixedFee ? `¥${existingContract.fixedFee.toLocaleString()}` : '未設定';
          await logBrandEdit(
            existingContract.brandId,
            "delete",
            "contract",
            input.id,
            `${existingContract.serviceType} ${feeStr}`,
            `契約を削除：${existingContract.serviceType} ${feeStr}`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }
        
        return { success: true };
      }),

    // Get all contracts (for statistics)
    listAll: protectedProcedure.query(async () => {
      return await getAllContracts();
    }),

    // Get active contracts count
    activeCount: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getActiveContractsCount(input.brandId);
      }),

    // Link a livestream to a contract
    linkLivestream: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          livestreamId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if link already exists
        const exists = await checkContractLivestreamLinkExists(
          input.contractId,
          input.livestreamId
        );
        if (exists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "この直播は既に契約に紐付けられています",
          });
        }

        const link = await createContractLivestreamLink({
          contractId: input.contractId,
          livestreamId: input.livestreamId,
          createdBy: ctx.user.id,
        });
        return link;
      }),

    // Unlink a livestream from a contract
    unlinkLivestream: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          livestreamId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await deleteContractLivestreamLink(input.contractId, input.livestreamId);
        return { success: true };
      }),

    // Get linked livestreams for a contract
    getLinkedLivestreams: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return await getContractLinkedLivestreams(input.contractId);
      }),

    // Calculate ROAS for a contract
    calculateRoas: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          fixedFee: z.number(),
        })
      )
      .query(async ({ input }) => {
        return await calculateContractRoas(input.contractId, input.fixedFee);
      }),

    // Bulk link livestreams to a contract
    bulkLinkLivestreams: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          livestreamIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[bulkLinkLivestreams] Input:", JSON.stringify(input, null, 2));
          // First, delete all existing links
          await deleteAllContractLivestreamLinks(input.contractId);

          // Then create new links
          const results = [];
          for (const livestreamId of input.livestreamIds) {
            const link = await createContractLivestreamLink({
              contractId: input.contractId,
              livestreamId,
              createdBy: ctx.user.id,
            });
            results.push(link);
          }
          console.log("[bulkLinkLivestreams] Success, created", results.length, "links");
          return results;
        } catch (error) {
          console.error("[bulkLinkLivestreams] Error:", error);
          throw error;
        }
      }),
  }),

  // AI Advice Router (日報AIアドバイス)
  aiAdvice: router({
    // Generate AI advice for a report
    generate: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        reportContent: z.string(),
        staffName: z.string().optional(),
        reportDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get good examples for learning
        const goodExamples = await getGoodLearningExamples(5);
        const badExamples = await getBadLearningExamples(3);

        // Build prompt with learning examples
        let examplesPrompt = "";
        if (goodExamples.length > 0) {
          examplesPrompt += "\n\n【良いアドバイスの例】\n";
          goodExamples.forEach((ex, i) => {
            examplesPrompt += `${i + 1}. 日報: "${ex.reportContent.substring(0, 100)}..."\n   アドバイス: "${ex.adviceText}"\n`;
          });
        }
        if (badExamples.length > 0) {
          examplesPrompt += "\n【避けるべきアドバイスの例】\n";
          badExamples.forEach((ex, i) => {
            examplesPrompt += `${i + 1}. "${ex.adviceText}" (このようなアドバイスは避けてください)\n`;
          });
        }

        const systemPrompt = `あなたはLCJ（ライブコマースジャパン）の業務アドバイザーAIです。
スタッフが書いた日報を分析し、具体的で実行可能なアドバイスを提供してください。

アドバイスのガイドライン:
1. 日報の内容に基づいた具体的な提案をする
2. 次のアクションやフォローアップを提案する
3. 時間管理や優先順位についてアドバイスする
4. ライバー、ブランド、イベントなどLCJの業務に特化したアドバイスをする
5. 短く、実用的なアドバイスを心がける（100文字以内）

日報が日本語の場合は日本語で、中国語の場合は中国語でアドバイスしてください。
${examplesPrompt}`;

        const userPrompt = `以下の日報に対してアドバイスを提供してください。

スタッフ: ${input.staffName || "不明"}
日付: ${input.reportDate || "不明"}

日報内容:
${input.reportContent}

アドバイスを100文字以内で提供してください。`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const rawContent = response.choices[0]?.message?.content;
          const adviceText = typeof rawContent === "string" ? rawContent : "アドバイスを生成できませんでした。";

          // Save the advice to database
          const advice = await createReportAiAdvice({
            reportId: input.reportId,
            adviceText,
            adviceType: "general",
            promptUsed: systemPrompt,
          });

          return advice;
        } catch (error) {
          console.error("AI advice generation error:", error);
          throw new Error("アドバイスの生成に失敗しました");
        }
      }),

    // Get AI advice for a report
    getByReportId: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return await getAiAdviceByReportId(input.reportId);
      }),

    // Submit feedback for AI advice
    submitFeedback: protectedProcedure
      .input(z.object({
        adviceId: z.number(),
        rating: z.enum(["good", "bad"]),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user already gave feedback
        const existingFeedback = await getUserFeedbackForAdvice(input.adviceId, ctx.user.id);

        if (existingFeedback) {
          // Update existing feedback
          await updateAiAdviceFeedback(existingFeedback.id, {
            rating: input.rating,
            comment: input.comment,
          });
        } else {
          // Create new feedback
          await createAiAdviceFeedback({
            adviceId: input.adviceId,
            userId: ctx.user.id,
            rating: input.rating,
            comment: input.comment,
          });
        }

        // Get the advice and report content for learning
        const advice = await getAiAdviceById(input.adviceId);
        if (advice) {
          const reportData = await getReportById(advice.reportId);
          if (reportData && reportData.report) {
            // Add to learning examples
            await upsertAiLearningExample({
              reportContent: reportData.report.workContent || "",
              adviceText: advice.adviceText,
              isGoodExample: input.rating === "good" ? "yes" : "no",
            });
          }
        }

        return { success: true };
      }),

    // Get user's feedback for an advice
    getUserFeedback: protectedProcedure
      .input(z.object({ adviceId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getUserFeedbackForAdvice(input.adviceId, ctx.user.id);
      }),

    // Get feedback statistics
    getStats: protectedProcedure.query(async () => {
      return await getAiFeedbackStats();
    }),
  }),

  // Chat Report Router (チャット形式の日報)
  chatReport: router({
    // Start or continue today's chat session
    startSession: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .mutation(async ({ input }) => {
        // Check if there's an existing session for today
        const existingSession = await getTodayChatSession(input.staffId);
        if (existingSession && existingSession.status !== "converted") {
          // Return existing session with messages
          const messages = await getMessagesBySessionId(existingSession.id);
          return { session: existingSession, messages, isNew: false };
        }

        // Create new session
        const session = await createChatReportSession({
          staffId: input.staffId,
          reportDate: new Date(),
          status: "in_progress",
        });

        // Increment staff chat count
        await incrementStaffChatCount(input.staffId);

        // Get staff profile for personalization
        const profile = await getOrCreateStaffAiProfile(input.staffId);

        // Get staff info to determine language
        const staffInfo = await getReportStaffById(input.staffId);
        const isChineseStaff = staffInfo?.country === "中国";

        // Get recent reports for context
        const recentReports = await getRecentReportsByStaffId(input.staffId, 3);

        // Get pending followups
        const pendingFollowups = await getFollowupsByStaffId(input.staffId);
        const pendingItems = pendingFollowups.filter(f => f.followup.status === "pending");

        // Generate personalized greeting
        const dayOfWeek = new Date().getDay();
        const dayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
        const dayNamesZh = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        const currentDayName = isChineseStaff ? dayNamesZh[dayOfWeek] : dayNames[dayOfWeek];

        let greetingContext = "";
        if (pendingItems.length > 0) {
          greetingContext += isChineseStaff 
            ? `\n您有${pendingItems.length}个待跟进事项未完成。`
            : `\n未完了のフォローアップが${pendingItems.length}件あります。`;
        }
        if (recentReports.length > 0) {
          const lastReport = recentReports[0];
          if (lastReport.issues) {
            greetingContext += isChineseStaff
              ? `\n上次的问题: ${lastReport.issues.substring(0, 50)}...`
              : `\n前回の課題: ${lastReport.issues.substring(0, 50)}...`;
          }
        }

        // Generate greeting message using AI (language based on staff country)
        const greetingPrompt = isChineseStaff
          ? `今天是${currentDayName}。
${greetingContext ? `上下文: ${greetingContext}` : ""}

请写一句问候员工并询问今天工作内容的话。
例: 「周二辛苦了！今天做了什么工作？」

绝对禁止: 不要输出任何英文、思考过程、字数统计、标签或解释。只输出纯中文问句。`
          : `今日は${currentDayName}です。
${greetingContext ? `コンテキスト: ${greetingContext}` : ""}

スタッフへの挨拶と今日の業務についての質問を一文で書いてください。
例: 「火曜日お疲れ様です！今日の業務は何をしましたか？」

絶対禁止: 英語、思考プロセス、文字数、タグ、説明は出力しないでください。純粋な日本語の質問文のみを出力してください。`;

        let greetingText = isChineseStaff
          ? `你好！今天是${currentDayName}。今天做了什么工作？`
          : `こんにちは！今日は${currentDayName}ですね。今日はどんな業務をしましたか？`;
        
        // Helper function to clean AI response from thinking process
        const cleanAiResponse = (text: string): string => {
          // Remove patterns like "(22 characters)", "**Review and Finalize:**", "**Final Output Generation:**"
          let cleaned = text;
          
          // Remove character count patterns
          cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
          
          // Remove numbered thinking steps with headers
          cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
          
          // Remove markdown headers like **Review and Finalize:** or **Final Output Generation:**
          cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
          
          // Remove lines starting with thinking process indicators
          cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
          
          // Remove parenthetical notes like (Self-correction: ...)
          cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
          cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
          
          // Clean up multiple newlines and trim
          cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
          
          // If the cleaned result is too short, try to extract just the question
          if (cleaned.length < 5) {
            // Try to find a question mark and extract the sentence
            const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
            if (questionMatch && questionMatch.length > 0) {
              cleaned = questionMatch[questionMatch.length - 1].trim();
            }
          }
          
          return cleaned;
        };

        try {
          const systemPrompt = isChineseStaff
            ? "你是日报助手。绝对禁止输出英文、思考过程、字数统计或标签。只输出纯中文问句。"
            : "あなたは日報アシスタントです。絶対禁止: 英語、思考プロセス、文字数、タグは出力しないでください。純粋な日本語の質問文のみを出力してください。";
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: greetingPrompt },
            ],
          });
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            greetingText = cleanAiResponse(content);
          }
        } catch (e) {
          console.error("Greeting generation error:", e);
        }

        // Add greeting message
        const greetingMessage = await addChatMessage({
          sessionId: session.id,
          role: "ai",
          content: greetingText,
          messageType: "greeting",
          questionCategory: "work_content",
        });

        return { session, messages: [greetingMessage], isNew: true };
      }),

    // Send a message in the chat
    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Save user message
        const userMessage = await addChatMessage({
          sessionId: input.sessionId,
          role: "user",
          content: input.content,
          messageType: "answer",
        });

        // Get session info
        const session = await getChatSessionById(input.sessionId);
        if (!session) throw new Error("Session not found");

        // Get all messages in session
        const allMessages = await getMessagesBySessionId(input.sessionId);
        
        // Get staff profile
        const profile = await getOrCreateStaffAiProfile(session.staffId);

        // Get staff info to determine language
        const staffInfo = await getReportStaffById(session.staffId);
        const isChineseStaff = staffInfo?.country === "中国";

        // Get recent reports for context
        const recentReports = await getRecentReportsByStaffId(session.staffId, 3);

        // Get pending followups
        const pendingFollowups = await getFollowupsByStaffId(session.staffId);
        const pendingItems = pendingFollowups.filter(f => f.followup.status === "pending");

        // Determine what to ask next based on conversation flow
        const userMessages = allMessages.filter(m => m.role === "user");
        const questionCount = userMessages.length;

        // Build context for AI (language based on staff country)
        // Only include context info for the FIRST question, not subsequent ones
        let contextInfo = "";
        if (questionCount === 1) {
          // Only on first response, mention pending items briefly
          if (pendingItems.length > 0) {
            contextInfo += isChineseStaff
              ? `\n待跟进事项: ${pendingItems.map(f => f.followup.extractedItem?.substring(0, 30)).join(", ")}`
              : `\n未完了のフォローアップ: ${pendingItems.map(f => f.followup.extractedItem?.substring(0, 30)).join(", ")}`;
          }
          if (recentReports.length > 0 && recentReports[0].issues) {
            contextInfo += isChineseStaff
              ? `\n上次的问题: ${recentReports[0].issues.substring(0, 50)}`
              : `\n前回の課題: ${recentReports[0].issues.substring(0, 50)}`;
          }
        }
        // After first question, focus on what user is actually talking about

        // Generate next question or summary based on conversation stage
        let systemPrompt = "";
        let userPrompt = "";

        if (questionCount >= 3) {
          // After 3+ messages, offer to summarize or ask if there's more
          systemPrompt = isChineseStaff
            ? `你是日报助手。只输出问句或确认消息，不要包含解释、思考过程、字数统计或标签。`
            : `あなたは日報アシスタントです。質問文または確認メッセージのみを出力してください。説明、思考プロセス、文字数、タグは含めないでください。`;
          userPrompt = isChineseStaff
            ? `之前的对话:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "员工"}: ${m.content}`).join("\n")}
${contextInfo ? `上下文: ${contextInfo}` : ""}

如果还有需要询问的内容请提问，否则请说“好的，我来整理日报吧！”`
            : `これまでの会話:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "スタッフ"}: ${m.content}`).join("\n")}
${contextInfo ? `コンテキスト: ${contextInfo}` : ""}

追加で聞くべきことがあれば質問し、なければ「ありがとうございます！日報をまとめますね。」と言ってください。`
        } else {
          // Continue asking questions
          const questionTopics = [
            "work_content", // 業務内容
            "issues",       // 気づき・課題
            "followup",     // フォローアップ
          ];
          const currentTopic = questionTopics[questionCount] || "followup";
          const topicNameJa = currentTopic === "work_content" ? "他の業務内容" : currentTopic === "issues" ? "気づきや課題" : "フォローアップが必要なこと";
          const topicNameZh = currentTopic === "work_content" ? "其他工作内容" : currentTopic === "issues" ? "发现或问题" : "需要跟进的事项";

          systemPrompt = isChineseStaff
            ? `你是日报助手。绝对禁止输出英文、思考过程、字数统计或标签。只输出纯中文问句。
重要：专注于用户最后一条消息的内容，不要反复询问之前已经讨论过的事项。`
            : `あなたは日報アシスタントです。絶対禁止: 英語、思考プロセス、文字数、タグは出力しないでください。純粋な日本語の質問文のみを出力してください。
重要: ユーザーの最新の回答内容に集中し、既に話した内容を繰り返し聴かないでください。`;
          userPrompt = isChineseStaff
            ? `之前的对话:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "员工"}: ${m.content}`).join("\n")}
${contextInfo ? `上下文: ${contextInfo}` : ""}

用户最后的回答是关于今天的工作。请根据用户的回答内容提问下一个问题，主题是: ${topicNameZh}
不要重复询问之前已经讨论过的内容。`
            : `これまでの会話:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "スタッフ"}: ${m.content}`).join("\n")}
${contextInfo ? `コンテキスト: ${contextInfo}` : ""}

ユーザーの最新の回答は今日の業務についてです。ユーザーの回答内容に基づいて次の質問をしてください。トピック: ${topicNameJa}
既に話した内容を繰り返し聴かないでください。`
        }

        // Helper function to clean AI response from thinking process
        const cleanAiResponse = (text: string): string => {
          // Remove patterns like "(22 characters)", "**Review and Finalize:**", "**Final Output Generation:**"
          let cleaned = text;
          
          // Remove character count patterns
          cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
          
          // Remove numbered thinking steps with headers
          cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
          
          // Remove markdown headers like **Review and Finalize:** or **Final Output Generation:**
          cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
          
          // Remove lines starting with thinking process indicators
          cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
          
          // Remove parenthetical notes like (Self-correction: ...)
          cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
          cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
          
          // Clean up multiple newlines and trim
          cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
          
          // If the cleaned result is too short, try to extract just the question
          if (cleaned.length < 5) {
            // Try to find a question mark and extract the sentence
            const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
            if (questionMatch && questionMatch.length > 0) {
              cleaned = questionMatch[questionMatch.length - 1].trim();
            }
          }
          
          return cleaned;
        };

        let aiResponseText = isChineseStaff ? "还有其他的吗？" : "他に何かありますか？";
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            aiResponseText = cleanAiResponse(content);
          }
        } catch (e) {
          console.error("AI response generation error:", e);
        }

        // Save AI response
        const aiMessage = await addChatMessage({
          sessionId: input.sessionId,
          role: "ai",
          content: aiResponseText,
          messageType: questionCount >= 3 ? "summary_prompt" : "question",
          questionCategory: questionCount >= 3 ? "summary" : ["work_content", "issues", "followup"][questionCount] || "followup",
        });

        return { userMessage, aiMessage };
      }),

    // Convert chat session to report
    convertToReport: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getChatSessionById(input.sessionId);
        if (!session) throw new Error("Session not found");

        // Get staff info to determine language
        const staffInfo = await getReportStaffById(session.staffId);
        const isChineseStaff = staffInfo?.country === "中国";

        // Get all user messages
        const userMessages = await getUserMessagesFromSession(input.sessionId);
        const allMessages = await getMessagesBySessionId(input.sessionId);

        // Use AI to summarize into report format (language based on staff country)
        const conversationText = allMessages
          .map(m => `${m.role === "ai" ? "AI" : (isChineseStaff ? "员工" : "スタッフ")}: ${m.content}`)
          .join("\n");

        const summaryPrompt = isChineseStaff
          ? `请根据以下聊天记录创建日报。

对话内容:
${conversationText}

请以以下JSON格式返回:
{
  "workContent": "工作内容（列表形式）",
  "issues": "发现・问题・课题"
}

请用中文简洁地整理。`
          : `以下のチャット会話から日報を作成してください。

会話内容:
${conversationText}

以下のJSON形式で返してください:
{
  "workContent": "業務内容（箇条書き）",
  "issues": "気づき・課題・問題点"
}

日本語で、簡潔にまとめてください。`;

        let workContent = userMessages.map(m => m.content).join("\n");
        let issues = "";

        try {
          const systemPrompt = isChineseStaff
            ? "你是日报创建助手。请将对话内容整理成日报格式。"
            : "あなたは日報作成アシスタントです。会話内容を日報形式にまとめてください。";
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: summaryPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "report_summary",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    workContent: { type: "string", description: "業務内容" },
                    issues: { type: "string", description: "気づき・課題" },
                  },
                  required: ["workContent", "issues"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            const parsed = JSON.parse(content);
            workContent = parsed.workContent || workContent;
            issues = parsed.issues || "";
          }
        } catch (e) {
          console.error("Report conversion error:", e);
        }

        // Create the report
        const report = await createReport({
          createdBy: ctx.user.id,
          reportStaffId: session.staffId,
          reportDate: session.reportDate,
          workContent,
          issues,
        });

        // Update session status
        if (report) {
          await updateChatSessionStatus(input.sessionId, "converted", report.id);
        }

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "report_create_chat",
          actionLabel: "チャットで日報を作成",
          targetType: "report",
          targetId: report?.id,
          metadata: { sessionId: input.sessionId },
        });

        return { success: true, report };
      }),

    // Get chat session by ID
    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const session = await getChatSessionById(input.sessionId);
        if (!session) return null;
        const messages = await getMessagesBySessionId(input.sessionId);
        return { session, messages };
      }),

    // Get staff's chat sessions
    getSessionsByStaff: protectedProcedure
      .input(z.object({ staffId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getChatSessionsByStaffId(input.staffId, input.limit || 30);
      }),

    // Get messages for a specific session
    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await getMessagesBySessionId(input.sessionId);
      }),

    // Get staff AI profile
    getStaffProfile: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        return await getOrCreateStaffAiProfile(input.staffId);
      }),

    // Transcribe voice to text
    transcribeVoice: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language,
          prompt: input.language === "zh" 
            ? "请将用户的语音转化为文字，这是一份日报内容"
            : "ユーザーの音声をテキストに変換してください。これは日報の内容です",
        });

        // Check if it's an error
        if ("error" in result) {
          throw new Error(result.error);
        }

        return {
          text: result.text,
          language: result.language,
          duration: result.duration,
        };
      }),
  }),

  // LINE Management Router
  line: router({
    listUsers: protectedProcedure.query(async () => {
      return await getAllLineUsers();
    }),

    // Get LINE users linked to livers with liver details
    listLiverLinkedUsers: protectedProcedure.query(async () => {
      return await getLineUsersWithLiverDetails();
    }),

    // Get liver interaction summary
    getLiverInteraction: protectedProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLiverInteractionSummary(input.liverId);
      }),

    listGroups: protectedProcedure.query(async () => {
      return await getAllLineGroups();
    }),

    listMessages: protectedProcedure
      .input(
        z.object({
          lineUserId: z.string().optional(),
          lineGroupId: z.string().optional(),
          limit: z.number().optional().default(50),
        })
      )
      .query(async ({ input }) => {
        return await getLineMessages({
          lineUserId: input.lineUserId,
          lineGroupId: input.lineGroupId,
          limit: input.limit,
        });
      }),

    sendMessage: protectedProcedure
      .input(
        z.object({
          to: z.string(),
          message: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const success = await pushMessage(input.to, [
          { type: "text", text: input.message },
        ]);

        if (success) {
          // Save outgoing message to database
          await saveLineMessage({
            messageId: `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceType: "user",
            lineUserId: input.to,
            messageType: "text",
            content: input.message,
            direction: "outgoing",
          });
        }

        return { success };
      }),

    // Link LINE user to brand/liver
    linkUser: protectedProcedure
      .input(
        z.object({
          lineUserId: z.string(),
          brandId: z.number().nullable().optional(),
          liverId: z.number().nullable().optional(),
          userType: z.enum(["customer", "staff", "liver", "unknown"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db
          .update(lineUsers)
          .set({
            brandId: input.brandId ?? null,
            liverId: input.liverId ?? null,
            userType: input.userType,
          })
          .where(eq(lineUsers.lineUserId, input.lineUserId));

        return { success: true };
      }),

    // Get LINE user details with linked brand/liver info
    getUserDetails: protectedProcedure
      .input(z.object({ lineUserId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db
          .select()
          .from(lineUsers)
          .where(eq(lineUsers.lineUserId, input.lineUserId))
          .limit(1);

        if (result.length === 0) return null;

        const user = result[0];

        // Get linked brand if exists
        let linkedBrand = null;
        if (user.brandId) {
          const brandResult = await db
            .select()
            .from(brands)
            .where(eq(brands.id, user.brandId))
            .limit(1);
          linkedBrand = brandResult[0] || null;
        }

        return {
          ...user,
          linkedBrand,
        };
      }),

    // List all follow-ups
    listFollowUps: protectedProcedure.query(async () => {
      return await getAllLineFollowUps();
    }),

    // Create a follow-up
    createFollowUp: protectedProcedure
      .input(
        z.object({
          targetType: z.enum(["user", "group"]),
          lineUserId: z.string().optional(),
          lineGroupId: z.string().optional(),
          triggerCondition: z.enum(["no_reply", "scheduled", "event"]),
          delayHours: z.number().optional().default(72),
          maxAttempts: z.number().optional().default(3),
          messageTemplate: z.string(),
          brandId: z.number().optional(),
          scheduledAt: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const nextScheduled = input.scheduledAt || new Date(Date.now() + input.delayHours * 60 * 60 * 1000);
        
        const result = await createLineFollowUp({
          targetType: input.targetType,
          lineUserId: input.lineUserId,
          lineGroupId: input.lineGroupId,
          triggerCondition: input.triggerCondition,
          delayHours: input.delayHours,
          maxAttempts: input.maxAttempts,
          messageTemplate: input.messageTemplate,
          brandId: input.brandId,
          createdBy: ctx.user.id,
          nextScheduledAt: nextScheduled,
        });
        
        return result;
      }),

    // Cancel a follow-up
    cancelFollowUp: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateLineFollowUpStatus(input.id, "cancelled");
        return { success: true };
      }),

    // Leave a LINE group
    leaveGroup: protectedProcedure
      .input(z.object({ lineGroupId: z.string() }))
      .mutation(async ({ input }) => {
        // Call LINE API to leave the group
        const success = await leaveGroup(input.lineGroupId);
        
        if (success) {
          // Update database to mark group as inactive
          const db = await getDb();
          if (db) {
            await db
              .update(lineGroups)
              .set({ isActive: false })
              .where(eq(lineGroups.lineGroupId, input.lineGroupId));
          }
        }
        
        return { success };
      }),

    // Update group auto follow-up settings
    updateGroupAutoFollowUp: protectedProcedure
      .input(
        z.object({
          lineGroupId: z.string(),
          autoFollowUpEnabled: z.boolean().optional(),
          autoFollowUpDays: z.number().min(1).max(30).optional(),
          autoFollowUpMessage: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateLineGroupAutoFollowUp(input.lineGroupId, {
          autoFollowUpEnabled: input.autoFollowUpEnabled,
          autoFollowUpDays: input.autoFollowUpDays,
          autoFollowUpMessage: input.autoFollowUpMessage,
        });
        return { success: true };
      }),

    // Get pending responses (messages that need staff response)
    getPendingResponses: protectedProcedure.query(async () => {
      return await getPendingResponsesForUI();
    }),

    // Mark a pending response as responded (manual)
    markAsResponded: protectedProcedure
      .input(z.object({ lineGroupId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await markMessageResponded(input.lineGroupId, ctx.user.email || "manual");
        return { success: true };
      }),

    // Cancel a pending response (dismiss without responding)
    cancelPendingResponse: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .mutation(async ({ input }) => {
        await cancelPendingResponse(input.messageId);
        return { success: true };
      }),
  }),

  // Schedule Management Router
  schedule: router({
    // Get all schedules for a date range
    getByDateRange: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        return await getSchedulesByDateRange(startDate, endDate);
      }),

    // Get schedules for a specific date
    getByDate: protectedProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        const date = new Date(input.date);
        return await getSchedulesByDate(date);
      }),

    // Get upcoming schedules
    getUpcoming: protectedProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input }) => {
        return await getUpcomingSchedules(input.days || 7);
      }),

    // Get schedules by liver name
    getByLiver: protectedProcedure
      .input(
        z.object({
          liverName: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const startDate = input.startDate ? new Date(input.startDate) : undefined;
        const endDate = input.endDate ? new Date(input.endDate) : undefined;
        return await getSchedulesByLiverName(input.liverName, startDate, endDate);
      }),

    // Get schedule by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getScheduleById(input.id);
      }),

    // Create a new schedule
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          liverId: z.number().optional(),
          liverName: z.string().optional(),
          brandId: z.number().optional(),
          lineGroupId: z.string().optional(),
          isRecurring: z.boolean().optional(),
          recurringPattern: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
          recurringEndDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const schedule = await createSchedule({
          title: input.title,
          description: input.description,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          isAllDay: input.isAllDay || false,
          category: input.category || "other",
          liverId: input.liverId,
          liverName: input.liverName,
          brandId: input.brandId,
          lineGroupId: input.lineGroupId,
          isRecurring: input.isRecurring || false,
          recurringPattern: input.recurringPattern,
          recurringEndDate: input.recurringEndDate ? new Date(input.recurringEndDate) : undefined,
          notes: input.notes,
          createdBy: ctx.user.id,
        });
        return schedule;
      }),

    // Update a schedule
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          liverId: z.number().optional(),
          liverName: z.string().optional(),
          brandId: z.number().optional(),
          lineGroupId: z.string().optional(),
          status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
        if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
        if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.liverId !== undefined) updateData.liverId = data.liverId;
        if (data.liverName !== undefined) updateData.liverName = data.liverName;
        if (data.brandId !== undefined) updateData.brandId = data.brandId;
        if (data.lineGroupId !== undefined) updateData.lineGroupId = data.lineGroupId;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;
        
        await updateSchedule(id, updateData);
        return { success: true };
      }),

    // Delete a schedule
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSchedule(input.id);
        return { success: true };
      }),

    // Public: Get upcoming schedules (no auth required)
    getPublicUpcoming: publicProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input }) => {
        return await getUpcomingSchedules(input.days || 14);
      }),

    // Public: Get schedules by date range (no auth required)
    getPublicByDateRange: publicProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        return await getSchedulesByDateRange(startDate, endDate);
      }),

    // Public: Get schedules by liver name (no auth required)
    getPublicByLiver: publicProcedure
      .input(
        z.object({
          liverName: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const startDate = input.startDate ? new Date(input.startDate) : undefined;
        const endDate = input.endDate ? new Date(input.endDate) : undefined;
        return await getSchedulesByLiverName(input.liverName, startDate, endDate);
      }),

    // Public: Get all unique liver names from schedules
    getPublicLiverNames: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const result = await db
          .selectDistinct({ liverName: schedules.liverName })
          .from(schedules)
          .where(and(
            isNotNull(schedules.liverName),
            not(eq(schedules.status, "cancelled"))
          ));
        return result
          .map(r => r.liverName)
          .filter((name): name is string => Boolean(name))
          .sort();
      }),

    // Public: Create a schedule (no auth required for public calendar)
    publicCreate: publicProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          liverName: z.string().min(1),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const schedule = await createSchedule({
          title: input.title,
          description: input.description,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          isAllDay: input.isAllDay || false,
          category: input.category || "other",
          liverName: input.liverName,
          notes: input.notes,
        });
        return schedule;
      }),

    // Public: Update a schedule (requires matching liverName)
    publicUpdate: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Get the schedule to check ownership
        const schedule = await getScheduleById(input.id);
        if (!schedule) {
          throw new TRPCError({ code: "NOT_FOUND", message: "予定が見つかりません" });
        }
        
        // Check if user owns this schedule (by matching liverName with user name)
        if (schedule.liverName !== ctx.user.name) {
          throw new TRPCError({ code: "FORBIDDEN", message: "この予定を編集する権限がありません" });
        }
        
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
        if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
        if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.notes !== undefined) updateData.notes = data.notes;
        
        await updateSchedule(id, updateData);
        return { success: true };
      }),

    // Public: Delete a schedule (requires matching liverName)
    publicDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Get the schedule to check ownership
        const schedule = await getScheduleById(input.id);
        if (!schedule) {
          throw new TRPCError({ code: "NOT_FOUND", message: "予定が見つかりません" });
        }
        
        // Check if user owns this schedule (by matching liverName with user name)
        if (schedule.liverName !== ctx.user.name) {
          throw new TRPCError({ code: "FORBIDDEN", message: "この予定を削除する権限がありません" });
        }
        
        await deleteSchedule(input.id);
        return { success: true };
      }),
  }),

  // Liver (Streamer) Authentication Router
  liver: liverRouter,

  // Liver Management Router (ライバー管理画面用)
  liverManagement: router({
    // Get all livers with stats for a given month (public - ログイン不要)
    listWithStats: publicProcedure
      .input(z.object({ month: z.string() })) // format: "YYYY-MM"
      .query(async ({ input }) => {
        return await getLiversWithStats(input.month);
      }),

    // Get liver rankings (sales and duration) (public - ログイン不要)
    rankings: publicProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ input }) => {
        return await getLiverRankings(input.month);
      }),

    // Get liver by ID with stats (public - ログイン不要)
    getById: publicProcedure
      .input(z.object({ id: z.number(), month: z.string().optional() }))
      .query(async ({ input }) => {
        const liver = await getLiverById(input.id);
        if (!liver) return null;
        
        const stats = input.month 
          ? await getLiverStatistics(input.id, input.month)
          : null;
        
        return { ...liver, stats };
      }),

    // Get livestreams by liver ID (public - ログイン不要)
    getLivestreams: publicProcedure
      .input(z.object({ liverId: z.number(), month: z.string().optional() }))
      .query(async ({ input }) => {
        return await getLivestreamsByLiverId(input.liverId, input.month);
      }),

    // Get livestream detail by ID (public - ログイン不要)
    getLivestreamDetail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const livestream = await getLivestreamById(input.id);
        if (!livestream) return null;
        
        // Get brand info
        const brand = await getBrandById(livestream.brandId);
        // Get liver info if liverId exists
        const liver = livestream.liverId ? await getLiverById(livestream.liverId) : null;
        
        return { ...livestream, brand, liver };
      }),

    // Update livestream result (配信結果の記録)
    updateLivestreamResult: protectedProcedure
      .input(z.object({
        id: z.number(),
        result: z.enum(["成功", "失敗"]).optional(),
        impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional(),
        resultReason: z.string().optional(),
        screenshotUrl: z.string().optional(),
        screenshotKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateLivestreamResult(id, data);
        return { success: true };
      }),

    // Create liver (admin only)
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(input.password, 10);
        const id = await createLiver({
          name: input.name,
          email: input.email,
          password: hashedPassword,
          color: input.color || "#FF69B4",
        });
        return { id };
      }),

    // Update liver (admin only)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateLiver(id, data);
        return { success: true };
      }),

    // Get all livers (for dropdown selection) (public - ログイン不要)
    listAll: publicProcedure.query(async () => {
      return await getAllLivers();
    }),

    // Create livestream record (配信履歴の記録)
    createLivestream: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        liverId: z.number(),
        scheduleId: z.number().optional(),
        livestreamDate: z.string(),
        livestreamEndTime: z.string().optional(),
        salesAmount: z.number().optional(),
        // AI解析データフィールド
        viewerCount: z.number().optional(),
        peakViewerCount: z.number().optional(),
        duration: z.number().optional(),
        productClicks: z.number().optional(),
        orderCount: z.number().optional(),
        impressions: z.number().optional(),
        gmv: z.number().optional(),
        cvr: z.string().optional(),
        ctr: z.string().optional(),
        // 配信結果フィールド
        result: z.enum(["成功", "失敗"]).optional(),
        impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional(),
        resultReason: z.string().optional(),
        remarks: z.string().optional(),
        screenshotUrl: z.string().optional(),
        aiAdvice: z.string().optional(), // AIアドバイスを保存
        // LINE通知用の構造化アドバイス
        structuredAdvice: z.object({
          summary: z.string().optional(),
          goodPoints: z.array(z.string()).optional(),
          improvements: z.array(z.string()).optional(),
          nextActions: z.array(z.object({
            action: z.string(),
            reason: z.string(),
            timing: z.string(),
          })).optional(),
          targetForNextTime: z.string().optional(),
        }).optional(),
        calculatedMetrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get liver info for streamerName and LINE notification
        const liver = await getLiverById(input.liverId);
        const streamerName = liver?.name || "不明";
        
        // 構造化アドバイスを永続保存用に変換
        const aiStructuredAdvice = input.structuredAdvice ? {
          summary: input.structuredAdvice.summary || '',
          goodPoints: input.structuredAdvice.goodPoints || [],
          improvements: input.structuredAdvice.improvements || [],
          actionPlans: (input.structuredAdvice.nextActions || []).map(a => ({
            action: a.action,
            reason: a.reason,
            timing: a.timing,
          })),
          nextGoal: input.structuredAdvice.targetForNextTime || '',
          calculatedMetrics: input.calculatedMetrics || {},
        } : undefined;
        
        const id = await createBrandLivestream({
          brandId: input.brandId,
          liverId: input.liverId,
          scheduleId: input.scheduleId,
          livestreamDate: new Date(input.livestreamDate),
          livestreamEndTime: input.livestreamEndTime ? new Date(input.livestreamEndTime) : undefined,
          salesAmount: input.salesAmount,
          // AI解析データを保存
          viewerCount: input.viewerCount,
          duration: input.duration,
          productClicks: input.productClicks,
          orderCount: input.orderCount,
          impressions: input.impressions,
          gmv: input.gmv || input.salesAmount, // GMVがない場合はsalesAmountを使用
          cvr: input.cvr,
          ctr: input.ctr,
          // 配信結果フィールド
          result: input.result,
          impactFactor: input.impactFactor,
          resultReason: input.resultReason,
          remarks: input.remarks,
          screenshotUrl: input.screenshotUrl,
          aiAdvice: input.aiAdvice, // AIアドバイスを保存
          aiStructuredAdvice, // 構造化アドバイスを永続保存
          streamerName,
          createdBy: ctx.user?.id || 0,
        });
        
        // Send LINE notification if liver has LINE connected and notifications enabled
        let lineNotificationSent = false;
        if (liver?.lineUserId && liver?.lineNotificationEnabled !== false) {
          try {
            const result = await sendCoachingToLiver(
              liver.lineUserId,
              liver.name,
              input.salesAmount || 0,
              input.structuredAdvice || null,
              input.calculatedMetrics as Record<string, string | number> | null | undefined,
              input.aiAdvice
            );
            lineNotificationSent = result.success;
            if (!result.success) {
              console.error("[LINE Coaching] Failed to send:", result.error);
            }
          } catch (error) {
            console.error("[LINE Coaching] Exception:", error);
          }
        }
        
        return { id, lineNotificationSent };
      }),

    // Update livestream (配信履歴の編集)
    updateLivestream: protectedProcedure
      .input(z.object({
        id: z.number(),
        brandId: z.number().optional(),
        livestreamDate: z.string().optional(),
        livestreamEndTime: z.string().optional().nullable(),
        salesAmount: z.number().optional().nullable(),
        viewerCount: z.number().optional().nullable(),
        duration: z.number().optional().nullable(),
        productClicks: z.number().optional().nullable(),
        orderCount: z.number().optional().nullable(),
        result: z.enum(["成功", "失敗"]).optional().nullable(),
        impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional().nullable(),
        resultReason: z.string().optional().nullable(),
        remarks: z.string().optional().nullable(),
        screenshotUrl: z.string().optional().nullable(),
        aiAdvice: z.string().optional().nullable(), // AIアドバイスを更新
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        if (data.brandId !== undefined) updateData.brandId = data.brandId;
        if (data.livestreamDate !== undefined) updateData.livestreamDate = new Date(data.livestreamDate);
        if (data.livestreamEndTime !== undefined) {
          updateData.livestreamEndTime = data.livestreamEndTime ? new Date(data.livestreamEndTime) : null;
        }
        if (data.salesAmount !== undefined) updateData.salesAmount = data.salesAmount;
        if (data.viewerCount !== undefined) updateData.viewerCount = data.viewerCount;
        if (data.duration !== undefined) updateData.duration = data.duration;
        if (data.productClicks !== undefined) updateData.productClicks = data.productClicks;
        if (data.orderCount !== undefined) updateData.orderCount = data.orderCount;
        if (data.result !== undefined) updateData.result = data.result;
        if (data.impactFactor !== undefined) updateData.impactFactor = data.impactFactor;
        if (data.resultReason !== undefined) updateData.resultReason = data.resultReason;
        if (data.remarks !== undefined) updateData.remarks = data.remarks;
        if (data.screenshotUrl !== undefined) updateData.screenshotUrl = data.screenshotUrl;
        if (data.aiAdvice !== undefined) updateData.aiAdvice = data.aiAdvice;
        
        await updateBrandLivestream(id, updateData);
        return { success: true };
      }),

    // Delete livestream (配信履歴の削除)
    deleteLivestream: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandLivestream(input.id);
        return { success: true };
      }),

    // Upload screenshot for livestream
    uploadScreenshot: protectedProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        liverId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.filename.split(".").pop() || "png";
        const timestamp = Date.now();
        const key = `livestreams/${input.liverId || ctx.user.id}/${timestamp}-${nanoid()}.${ext}`;
        const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        
        const { url } = await storagePut(key, buffer, contentType);
        return { url, key };
      }),

    // Analyze screenshot to extract livestream data
    analyzeScreenshot: protectedProcedure
      .input(z.object({
        imageUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = `あなたはTikTokライブ配信のダッシュボードスクリーンショットを解析するエキスパートです。

TikTok LIVEダッシュボードの典型的なレイアウト：
- 中央上部: GMV（総売上金額）が大きく表示（例: 8,814,883）
- その下: 商品販売数、視聴者数
- 左側: パフォーマンストレンドグラフ、トラフィックソース
- 中央: インプレッション数、商品クリック数、LIVE CTR、注文数、注文率など
- 右側: リプレイ動画、ユーザープロフィール
- 上部ヘッダー: 配信時間（例: 8h10m6s）、日時範囲（例: Dec 29 16:00:54 - Dec 30 00:11:00 UTC+09:00）

【重要】以下の情報を抽出してください：
1. GMV/売上金額（中央の大きな数字）- salesAmount
2. 視聴者数（視聴者数/視聴数と表示）- viewerCount
3. 商品クリック数 - productClicks
4. 注文数/注文 - orderCount
5. 配信時間（ヘッダーの時間表示から分に変換）- durationMinutes
6. 【必須】配信開始日時（ヘッダーの日時範囲から）- startDateTime（YYYY-MM-DD HH:mm形式）
7. 【必須】配信終了日時（ヘッダーの日時範囲から）- endDateTime（YYYY-MM-DD HH:mm形式）
8. インプレッション数 - impressions
9. LIVE CTR（%）- liveCtr
10. 注文率/注文率（SKU注文数）（%）- orderRate
11. 1時間あたりのGMV - gmvPerHour
12. コメント率（%）- commentRate
13. 広告費 - adCost
14. ROI - roi
15. 商品販売数 - productSales

数値の読み取りルール：
- "K"は1000倍（例: 45.57K = 45570）
- "M"は1000000倍（例: 1.08M = 1080000）
- カンマは無視（例: 8,814,883 = 8814883）
- 時間表示（例: 8h10m6s）は分に変換（8*60+10=490分）

【日時抽出ルール - 最重要】
- 画面上部のヘッダーに日時範囲が表示されています（例: "Dec 29 16:00:54 - Dec 30 00:11:00 UTC+09:00"）
- 日時形式の例:
  - "Dec 29 16:00:54" → "2025-12-29 16:00"
  - "Jan 30 10:30:00" → "2025-01-30 10:30"
  - "2025/01/30 10:30" → "2025-01-30 10:30"
- 年が表示されていない場合は2025年と仮定してください
- startDateTimeとendDateTimeは必ず抽出してください。見つからない場合でもnullではなく、画面から推測できる情報を使ってください

必ず以下のJSON形式で返してください：
{
  "salesAmount": 数値,
  "viewerCount": 数値,
  "productClicks": 数値,
  "orderCount": 数値,
  "durationMinutes": 数値,
  "startDateTime": "YYYY-MM-DD HH:mm",
  "endDateTime": "YYYY-MM-DD HH:mm",
  "rawData": {
    "impressions": 数値,
    "liveCtr": 数値,
    "orderRate": 数値,
    "gmvPerHour": 数値,
    "commentRate": 数値,
    "adCost": 数値,
    "roi": 数値,
    "productSales": 数値
  },
  "confidence": "high" または "medium" または "low"
}

【注意】startDateTimeとendDateTimeは絶対にnullにしないでください。画面に日時情報がある場合は必ず抽出してください。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: input.imageUrl,
                    detail: "high",
                  },
                },
                {
                  type: "text",
                  text: "このTikTokライブ配信ダッシュボードのスクリーンショットから、配信データを抽出してください。",
                },
              ],
            },
          ],

        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Failed to analyze screenshot");
        }

        try {
          // Try to extract JSON from markdown code blocks if present
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          
          // Parse the JSON
          const parsed = JSON.parse(jsonStr);
          
          // Debug log
          console.log("[analyzeScreenshot] Parsed result:", JSON.stringify(parsed, null, 2));
          console.log("[analyzeScreenshot] startDateTime:", parsed.startDateTime);
          console.log("[analyzeScreenshot] endDateTime:", parsed.endDateTime);
          
          // Ensure required fields exist with defaults
          return {
            salesAmount: parsed.salesAmount ?? null,
            viewerCount: parsed.viewerCount ?? null,
            peakViewerCount: parsed.peakViewerCount ?? null,
            productClicks: parsed.productClicks ?? null,
            orderCount: parsed.orderCount ?? null,
            durationMinutes: parsed.durationMinutes ?? null,
            startDateTime: parsed.startDateTime ?? null,
            endDateTime: parsed.endDateTime ?? null,
            rawData: parsed.rawData ?? {},
            confidence: parsed.confidence ?? "medium",
          };
        } catch (e) {
          console.error("Failed to parse analysis result:", content, e);
          throw new Error("Failed to parse analysis result");
        }
      }),

    // Generate advice based on livestream data
    generateAdvice: protectedProcedure
      .input(z.object({
        salesAmount: z.number().optional(),
        viewerCount: z.number().optional(),
        peakViewerCount: z.number().optional(),
        productClicks: z.number().optional(),
        orderCount: z.number().optional(),
        durationMinutes: z.number().optional(),
        result: z.string().optional(),
        impactFactor: z.string().optional(),
        liverId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // 基本指標の計算
        const metrics: Record<string, string | number> = {};
        
        if (input.salesAmount) metrics["売上金額"] = `¥${input.salesAmount.toLocaleString()}`;
        if (input.viewerCount) metrics["視聴者数"] = input.viewerCount.toLocaleString();
        if (input.peakViewerCount) metrics["ピーク視聴者数"] = input.peakViewerCount.toLocaleString();
        if (input.productClicks) metrics["商品クリック数"] = input.productClicks.toLocaleString();
        if (input.orderCount) metrics["注文数"] = input.orderCount.toLocaleString();
        if (input.durationMinutes) metrics["配信時間"] = `${input.durationMinutes}分`;
        
        // 計算指標
        if (input.productClicks && input.orderCount && input.productClicks > 0) {
          const cvr = (input.orderCount / input.productClicks * 100).toFixed(2);
          metrics["コンバージョン率(CVR)"] = `${cvr}%`;
        }
        
        if (input.salesAmount && input.orderCount && input.orderCount > 0) {
          const avgOrderValue = Math.round(input.salesAmount / input.orderCount);
          metrics["客単価"] = `¥${avgOrderValue.toLocaleString()}`;
        }
        
        if (input.salesAmount && input.durationMinutes && input.durationMinutes > 0) {
          const salesPerHour = Math.round(input.salesAmount / (input.durationMinutes / 60));
          metrics["時間効率(売上/時)"] = `¥${salesPerHour.toLocaleString()}`;
        }
        
        if (input.productClicks && input.viewerCount && input.viewerCount > 0) {
          const engagementRate = (input.productClicks / input.viewerCount * 100).toFixed(2);
          metrics["エンゲージメント率"] = `${engagementRate}%`;
        }
        
        // 過去データの取得（ライバーIDがある場合）
        let historicalContext = "";
        if (input.liverId) {
          try {
            const pastLivestreams = await getLivestreamsByLiverId(input.liverId);
            if (pastLivestreams.length > 1) {
              const recentStreams = pastLivestreams.slice(0, 10);
              const avgSales = Math.round(recentStreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0) / recentStreams.length);
              const avgDuration = Math.round(recentStreams.reduce((sum, ls) => sum + (ls.duration || 0), 0) / recentStreams.length);
              const totalStreams = pastLivestreams.length;
              
              historicalContext = `

【過去の配信実績】
- 総配信回数: ${totalStreams}回
- 直近10回の平均売上: ¥${avgSales.toLocaleString()}
- 直近10回の平均配信時間: ${avgDuration}分`;
              
              // 今回との比較
              if (input.salesAmount) {
                const salesDiff = input.salesAmount - avgSales;
                const salesDiffPercent = avgSales > 0 ? Math.round((salesDiff / avgSales) * 100) : 0;
                historicalContext += `\n- 今回の売上は平均比: ${salesDiffPercent >= 0 ? '+' : ''}${salesDiffPercent}%`;
              }
            }
          } catch (e) {
            console.error("Failed to get historical data:", e);
          }
        }
        
        const metricsDescription = Object.entries(metrics)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");

        const systemPrompt = `あなたはTikTokライブ配信の専門コーチです。
ライバーが次回の配信で実践できる具体的なアドバイスを提供してください。

【回答フォーマット】
以下のJSON形式で回答してください：
{
  "summary": "今回の配信の総評（1文）",
  "goodPoints": ["良かった点（数値根拠あり）"],
  "improvements": ["改善ポイント（具体的に）"],
  "nextActions": [
    {
      "action": "次回やるべきこと",
      "reason": "なぜそれが効果的か",
      "timing": "いつやるか（例：配信開始30分以内）"
    }
  ],
  "targetForNextTime": "次回の具体的な目標（例：売上¥XXX万、CVR X%）"
}

【アドバイスの観点】
- コンバージョン率(CVR)の改善: クリックから購入への導線
- 客単価の向上: セット販売、アップセル
- 時間効率: 売れる時間帯の集中
- エンゲージメント: コメント返し、質問回答
- 商品紹介: 価格とメリットの伝え方

必ずJSONのみを出力してください。説明文は不要です。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `以下の配信データを分析して、次回の配信に向けたアドバイスをください。

【今回の配信データ】
${metricsDescription}${historicalContext}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          return { 
            advice: "データを分析中です。もう一度お試しください。",
            structured: null,
            metrics
          };
        }

        // JSONをパース
        try {
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          
          const structured = JSON.parse(jsonStr);
          
          // 従来のワンポイントアドバイスも生成（後方互換性）
          const simpleAdvice = structured.improvements?.[0] 
            ? `${structured.improvements[0]}。具体的なアドバイス：「${structured.nextActions?.[0]?.action || '次回の配信で試してみましょう'}」`
            : content.trim();
          
          return { 
            advice: simpleAdvice,
            structured,
            metrics
          };
        } catch (e) {
          // JSONパース失敗時は従来のテキストを返す
          return { 
            advice: content.trim(),
            structured: null,
            metrics
          };
        }
      }),
  }),

  // Brand Files Router
  brandFiles: router({
    // Get all files for a brand
    list: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        const files = await getBrandFiles(input.brandId);
        return files;
      }),

    // Create a new file record
    create: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileName: z.string(),
        fileUrl: z.string(),
        fileKey: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createBrandFile({
          brandId: input.brandId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          uploadedBy: ctx.user.id,
          uploadedByName: ctx.user.name || ctx.user.email,
        });

        // Log the edit
        await logBrandEdit(
          input.brandId,
          "create",
          "memo", // Using memo as closest type for files
          result.id,
          input.fileName,
          `ファイル「${input.fileName}」をアップロードしました`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );

        return result;
      }),

    // Delete a file
    delete: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        brandId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteBrandFile(input.fileId, input.brandId);

        // Log the edit
        await logBrandEdit(
          input.brandId,
          "delete",
          "memo", // Using memo as closest type for files
          input.fileId,
          result.fileName,
          `ファイル「${result.fileName}」を削除しました`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );

        return result;
      }),
  }),

  // Product Links Router
  productLinks: router({
    // Get all links for a product
    list: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        const links = await getProductLinks(input.productId);
        return links;
      }),

    // Get links for multiple products
    listForProducts: protectedProcedure
      .input(z.object({ productIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        const links = await getProductLinksForProducts(input.productIds);
        return links;
      }),

    // Add a new link to a product
    add: protectedProcedure
      .input(z.object({
        productId: z.number(),
        title: z.string().min(1, "タイトルを入力してください"),
        url: z.string().url("有効なURLを入力してください"),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addProductLink({
          productId: input.productId,
          title: input.title,
          url: input.url,
          createdBy: ctx.user.id,
        });

        // Get the product to find the brand for logging
        const product = await getBrandProductById(input.productId);
        if (product) {
          await logBrandEdit(
            product.brandId,
            "create",
            "product",
            input.productId,
            product.productName || "商品",
            `リンク「${input.title}」を追加しました`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }

        return result;
      }),

    // Update a link
    update: protectedProcedure
      .input(z.object({
        linkId: z.number(),
        title: z.string().min(1, "タイトルを入力してください").optional(),
        url: z.string().url("有効なURLを入力してください").optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { linkId, ...data } = input;
        const result = await updateProductLink(linkId, data);
        return result;
      }),

    // Delete a link
    delete: protectedProcedure
      .input(z.object({
        linkId: z.number(),
        productId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteProductLink(input.linkId);

        // Get the product to find the brand for logging
        const product = await getBrandProductById(input.productId);
        if (product) {
          await logBrandEdit(
            product.brandId,
            "delete",
            "product",
            input.productId,
            product.productName || "商品",
            `リンクを削除しました`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }

        return result;
      }),
  }),

  // CSV Import Router (TikTok配信パフォーマンスCSVインポート)
  csvImport: router({
    // Parse and import CSV data
    importLivestreams: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        liverId: z.number(),
        csvData: z.array(z.object({
          livestream: z.string(),
          startTime: z.string(),
          duration: z.number(), // in seconds
          grossRevenue: z.number(),
          directGmv: z.number(),
          itemsSold: z.number(),
          customers: z.number(),
          avgPrice: z.number(),
          ordersPaidFor: z.number(),
          gmvPer1kShows: z.string(),
          gmvPer1kViews: z.string(),
          views: z.number(),
          viewers: z.number(),
          peakViewers: z.number(),
          newFollowers: z.number(),
          avgViewDuration: z.number(), // in seconds
          likes: z.number(),
          comments: z.number(),
          shares: z.number(),
          productImpressions: z.number(),
          productClicks: z.number(),
          ctr: z.string(),
          ctor: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = {
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [] as string[],
        };

        // Get brand info for streamer name
        const brand = await getBrandById(input.brandId);
        const streamerName = brand?.name || "Unknown";

        for (const row of input.csvData) {
          try {
            // Parse start time as JST and convert to UTC
            // CSV dates from TikTok are in JST (Japan Standard Time, UTC+9)
            const jstDateStr = row.startTime;
            console.log('[CSV Import] Input date string:', jstDateStr);
            
            // Use ISO 8601 format for reliable parsing across all environments
            // Convert "2025-08-31 06:00" to "2025-08-31T06:00:00+09:00"
            const isoFormat = jstDateStr.replace(' ', 'T') + ':00+09:00';
            const startDate = new Date(isoFormat);
            console.log('[CSV Import] ISO format:', isoFormat);
            console.log('[CSV Import] Parsed UTC:', startDate.toISOString());
            const endDate = new Date(startDate.getTime() + row.duration * 1000);
            const durationMinutes = Math.round(row.duration / 60);

            // Check for existing livestream
            const existing = await findExistingLivestream(
              input.brandId,
              startDate,
              streamerName
            );

            const livestreamData = {
              brandId: input.brandId,
              liverId: input.liverId,
              livestreamDate: startDate,
              livestreamEndTime: endDate,
              streamerName,
              salesAmount: row.grossRevenue,
              gmv: row.directGmv,
              duration: durationMinutes,
              viewerCount: row.viewers,
              peakViewers: row.peakViewers,
              orderCount: row.ordersPaidFor,
              productClicks: row.productClicks,
              impressions: row.productImpressions,
              itemsSold: row.itemsSold,
              customerCount: row.customers,
              avgPrice: row.avgPrice,
              newFollowers: row.newFollowers,
              avgViewDuration: row.avgViewDuration,
              likes: row.likes,
              comments: row.comments,
              shares: row.shares,
              gmvPer1kShows: row.gmvPer1kShows,
              gmvPer1kViews: row.gmvPer1kViews,
              ctr: row.ctr,
              ctor: row.ctor,
              platform: "TikTok",
              createdBy: ctx.user.id,
            };

            if (existing) {
              // Update existing record
              await updateLivestreamFromCsv(existing.id, livestreamData);
              results.updated++;
            } else {
              // Create new record
              await createLivestreamFromCsv(livestreamData as any);
              results.created++;
            }
          } catch (error) {
            results.errors.push(`Row ${row.startTime}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        // Save import history
        if (results.created > 0 || results.updated > 0) {
          // Calculate date range
          const dates = input.csvData.map(row => new Date(row.startTime)).filter(d => !isNaN(d.getTime()));
          const dateRangeStart = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
          const dateRangeEnd = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
          const totalGmv = input.csvData.reduce((sum, row) => sum + row.grossRevenue, 0);
          
          await createLivestreamCsvImportHistory({
            liverId: input.liverId,
            brandId: input.brandId,
            fileName: `TikTok配信データ_${new Date().toISOString().slice(0, 10)}.xlsx`,
            livestreamCount: input.csvData.length,
            createdCount: results.created,
            updatedCount: results.updated,
            totalGmv,
            dateRangeStart,
            dateRangeEnd,
            importedBy: ctx.user.id,
            importedByName: ctx.user.name || ctx.user.email,
          });
        }

        return results;
      }),

    // Get CSV imported livestreams
    getImported: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getCsvImportedLivestreams(input.brandId);
      }),
      
    // Get import history for a liver
    getImportHistory: protectedProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamCsvImportHistoryByLiver(input.liverId);
      }),
      
    // Delete import history and associated livestreams
    deleteImportHistory: protectedProcedure
      .input(z.object({ historyId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteLivestreamCsvImportHistory(input.historyId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
