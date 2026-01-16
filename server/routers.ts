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
        })
      )
      .mutation(async ({ input }) => {
        await createStaff({
          name: input.name,
          email: input.email,
          department: input.department,
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
});

export type AppRouter = typeof appRouter;
