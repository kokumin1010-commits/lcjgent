import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  fetchPublicTikTokAccount,
  fetchPublicTikTokVideos,
} from "./tiktokPublicProvider";
import { nextTikTokSyncDelayHours } from "../shared/tiktokPublicMonitor";
import { ensureTikTokPublicMonitorReady } from "./tiktokPublicMonitorUpgrade";

let runtimePool: Pool | undefined;
function pool() {
  if (!runtimePool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    runtimePool = mysql.createPool({
      uri,
      connectionLimit: 4,
      waitForConnections: true,
      queueLimit: 30,
    });
  }
  return runtimePool;
}
function snapshotHour(now = new Date()) {
  return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
}
function errorMessage(error: unknown) {
  return String(error instanceof Error ? error.message : error).slice(0, 2000);
}

async function saveSuccessfulSync(
  accountId: number,
  username: string,
  triggerType: string
) {
  const [runResult] = await pool().query<ResultSetHeader>(
    "INSERT INTO tiktok_public_sync_runs (accountId,triggerType,status) VALUES (?,?,'running')",
    [accountId, triggerType]
  );
  const runId = Number(runResult.insertId);
  try {
    // The external calls happen before a DB connection/transaction is acquired.
    const [account, videos] = await Promise.all([
      fetchPublicTikTokAccount(username),
      fetchPublicTikTokVideos(username, 35),
    ]);
    const now = new Date();
    const hour = snapshotHour(now);
    const connection = await pool().getConnection();
    try {
      await connection.beginTransaction();
      const [knownRows] = await connection.query<RowDataPacket[]>(
        "SELECT externalVideoId FROM tiktok_public_videos WHERE accountId=?",
        [accountId]
      );
      const known = new Set(knownRows.map(row => String(row.externalVideoId)));
      let discovered = 0;
      for (const video of videos) {
        if (!known.has(video.externalVideoId)) discovered += 1;
        const [videoResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO tiktok_public_videos
            (accountId,externalVideoId,videoUrl,title,coverUrl,duration,publishedAt,playCount,likeCount,commentCount,shareCount,collectCount,lastSyncedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),videoUrl=VALUES(videoUrl),title=VALUES(title),coverUrl=VALUES(coverUrl),
             duration=VALUES(duration),publishedAt=VALUES(publishedAt),playCount=VALUES(playCount),likeCount=VALUES(likeCount),
             commentCount=VALUES(commentCount),shareCount=VALUES(shareCount),collectCount=VALUES(collectCount),lastSyncedAt=VALUES(lastSyncedAt)`,
          [
            accountId,
            video.externalVideoId,
            video.videoUrl,
            video.title,
            video.coverUrl,
            video.duration,
            video.publishedAt,
            video.playCount,
            video.likeCount,
            video.commentCount,
            video.shareCount,
            video.collectCount,
            now,
          ]
        );
        const videoId = Number(videoResult.insertId || 0);
        if (!videoId)
          throw new Error(
            `Unable to resolve saved TikTok video ${video.externalVideoId}`
          );
        await connection.query(
          `INSERT INTO tiktok_public_video_snapshots
            (videoId,snapshotHour,playCount,likeCount,commentCount,shareCount,collectCount)
           VALUES (?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE playCount=VALUES(playCount),likeCount=VALUES(likeCount),commentCount=VALUES(commentCount),
             shareCount=VALUES(shareCount),collectCount=VALUES(collectCount)`,
          [
            videoId,
            hour,
            video.playCount,
            video.likeCount,
            video.commentCount,
            video.shareCount,
            video.collectCount,
          ]
        );
      }
      await connection.query(
        `INSERT INTO tiktok_public_account_snapshots
          (accountId,snapshotHour,followerCount,followingCount,totalLikes,videoCount)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE followerCount=VALUES(followerCount),followingCount=VALUES(followingCount),
           totalLikes=VALUES(totalLikes),videoCount=VALUES(videoCount)`,
        [
          accountId,
          hour,
          account.followerCount,
          account.followingCount,
          account.heartCount,
          account.videoCount,
        ]
      );
      const newest = videos.reduce<Date | null>(
        (latest, video) =>
          !latest || video.publishedAt > latest ? video.publishedAt : latest,
        null
      );
      const delayHours = nextTikTokSyncDelayHours(newest, now);
      const next = new Date(now.getTime() + delayHours * 3_600_000);
      await connection.query(
        `UPDATE svm_accounts SET displayName=COALESCE(?,displayName),profileUrl=?,avatarUrl=COALESCE(?,avatarUrl),description=COALESCE(?,description),
           followerCount=?,followingCount=?,totalLikes=?,publicVideoCount=?,tiktokUserId=COALESCE(?,tiktokUserId),secUid=COALESCE(?,secUid),
           publicProvider='rapidapi_tikwm',monitorEnabled=TRUE,lastPostDate=COALESCE(?,lastPostDate),lastPublicSyncAt=?,nextPublicSyncAt=?,
           publicSyncStatus='success',publicSyncError=NULL,updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
        [
          account.displayName,
          `https://www.tiktok.com/@${username}`,
          account.avatarUrl,
          account.bio,
          account.followerCount,
          account.followingCount,
          account.heartCount,
          account.videoCount,
          account.externalUserId,
          account.secUid,
          newest,
          now,
          next,
          accountId,
        ]
      );
      await connection.query(
        "UPDATE tiktok_public_sync_runs SET status='success',discoveredVideos=?,updatedVideos=?,completedAt=CURRENT_TIMESTAMP WHERE id=?",
        [discovered, videos.length, runId]
      );
      await connection.commit();
      return {
        accountId,
        username,
        discoveredVideos: discovered,
        updatedVideos: videos.length,
        nextSyncAt: next.toISOString(),
      };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    const message = errorMessage(error);
    await Promise.allSettled([
      pool().query(
        "UPDATE svm_accounts SET publicSyncStatus='failed',publicSyncError=?,nextPublicSyncAt=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 6 HOUR),updatedAt=CURRENT_TIMESTAMP WHERE id=?",
        [message, accountId]
      ),
      pool().query(
        "UPDATE tiktok_public_sync_runs SET status='failed',errorMessage=?,completedAt=CURRENT_TIMESTAMP WHERE id=?",
        [message, runId]
      ),
    ]);
    throw error;
  }
}

export async function syncTikTokPublicAccount(
  accountId: number,
  triggerType: "manual" | "scheduled" | "register"
) {
  await ensureTikTokPublicMonitorReady();
  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT id,accountName,status,monitorEnabled FROM svm_accounts WHERE id=? LIMIT 1",
    [accountId]
  );
  const row = rows[0];
  if (!row || String(row.status) === "archived")
    throw new Error("TikTok account not found or archived");
  return saveSuccessfulSync(accountId, String(row.accountName), triggerType);
}

export async function syncDueTikTokPublicAccounts(limit = 6) {
  await ensureTikTokPublicMonitorReady();
  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT id FROM svm_accounts WHERE platform='tiktok' AND status='active' AND monitorEnabled=TRUE
      AND (nextPublicSyncAt IS NULL OR nextPublicSyncAt<=CURRENT_TIMESTAMP) ORDER BY COALESCE(nextPublicSyncAt,'1970-01-01'),id LIMIT ?`,
    [Math.max(1, Math.min(12, limit))]
  );
  const results: unknown[] = [];
  for (let index = 0; index < rows.length; index += 3) {
    const batch = rows.slice(index, index + 3);
    results.push(
      ...(await Promise.all(
        batch.map(async row => {
          const accountId = Number(row.id);
          const [claim] = await pool().query<ResultSetHeader>(
            `UPDATE svm_accounts SET publicSyncStatus='syncing',nextPublicSyncAt=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 30 MINUTE)
         WHERE id=? AND monitorEnabled=TRUE AND (nextPublicSyncAt IS NULL OR nextPublicSyncAt<=CURRENT_TIMESTAMP)`,
            [accountId]
          );
          if (!claim.affectedRows) return { accountId, skipped: true };
          try {
            return await syncTikTokPublicAccount(accountId, "scheduled");
          } catch (error) {
            return { accountId, error: errorMessage(error) };
          }
        })
      ))
    );
  }
  return {
    processed: results.filter(
      result => !(result as { skipped?: boolean }).skipped
    ).length,
    results,
  };
}

export async function registerTikTokPublicAccounts(usernames: string[]) {
  await ensureTikTokPublicMonitorReady();
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    const ids: number[] = [];
    let created = 0;
    let duplicates = 0;
    for (const username of usernames) {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM svm_accounts WHERE LOWER(accountName)=LOWER(?) AND platform='tiktok' AND status!='archived' ORDER BY id LIMIT 1 FOR UPDATE",
        [username]
      );
      let id = Number(rows[0]?.id || 0);
      if (id) {
        duplicates += 1;
        await connection.query(
          "UPDATE svm_accounts SET monitorEnabled=TRUE,profileUrl=?,nextPublicSyncAt=CURRENT_TIMESTAMP,publicSyncStatus='pending',publicSyncError=NULL WHERE id=?",
          [`https://www.tiktok.com/@${username}`, id]
        );
      } else {
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO svm_accounts (accountName,displayName,platform,profileUrl,status,monitorEnabled,publicProvider,nextPublicSyncAt,publicSyncStatus)
           VALUES (?,?, 'tiktok',?,'active',TRUE,'rapidapi_tikwm',CURRENT_TIMESTAMP,'pending')`,
          [username, username, `https://www.tiktok.com/@${username}`]
        );
        id = Number(result.insertId);
        created += 1;
      }
      ids.push(id);
    }
    await connection.commit();
    return { accountIds: ids, created, duplicates };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setTikTokPublicMonitoring(
  accountId: number,
  enabled: boolean
) {
  await ensureTikTokPublicMonitorReady();
  await pool().query(
    `UPDATE svm_accounts SET monitorEnabled=?,publicSyncStatus=?,nextPublicSyncAt=${enabled ? "CURRENT_TIMESTAMP" : "NULL"},updatedAt=CURRENT_TIMESTAMP WHERE id=? AND platform='tiktok' AND status!='archived'`,
    [enabled, enabled ? "pending" : "paused", accountId]
  );
}

export async function getTikTokPublicDashboard(month: string) {
  await ensureTikTokPublicMonitorReady();
  const start = `${month}-01`;
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const endText = end.toISOString().slice(0, 10);
  const [accounts] = await pool().query<RowDataPacket[]>(
    `SELECT id,accountName,displayName,profileUrl,avatarUrl,description,followerCount,followingCount,totalLikes,publicVideoCount,
      monitorEnabled,lastPublicSyncAt,nextPublicSyncAt,publicSyncStatus,publicSyncError,status
     FROM svm_accounts WHERE platform='tiktok' AND status!='archived' ORDER BY monitorEnabled DESC,accountName,id`
  );
  const [videos] = await pool().query<RowDataPacket[]>(
    `SELECT v.*,a.accountName,a.displayName,
      firstSnapshot.playCount firstPlayCount,firstSnapshot.likeCount firstLikeCount,
      firstSnapshot.commentCount firstCommentCount,firstSnapshot.shareCount firstShareCount,firstSnapshot.collectCount firstCollectCount
     FROM tiktok_public_videos v
     JOIN svm_accounts a ON a.id=v.accountId
     LEFT JOIN tiktok_public_video_snapshots firstSnapshot ON firstSnapshot.id=(
       SELECT s.id FROM tiktok_public_video_snapshots s WHERE s.videoId=v.id ORDER BY s.snapshotHour ASC,s.id ASC LIMIT 1
     )
     WHERE v.publishedAt>=? AND v.publishedAt<? ORDER BY v.publishedAt DESC,v.id DESC LIMIT 300`,
    [start, endText]
  );
  const [runs] = await pool().query<RowDataPacket[]>(
    `SELECT r.id,r.accountId,a.accountName,r.triggerType,r.status,r.discoveredVideos,r.updatedVideos,r.errorMessage,r.startedAt,r.completedAt
     FROM tiktok_public_sync_runs r LEFT JOIN svm_accounts a ON a.id=r.accountId ORDER BY r.id DESC LIMIT 30`
  );
  const mappedVideos = videos.map(row => ({
    id: Number(row.id),
    accountId: Number(row.accountId),
    accountName: String(row.displayName || row.accountName),
    externalVideoId: String(row.externalVideoId),
    videoUrl: String(row.videoUrl),
    title: row.title == null ? null : String(row.title),
    coverUrl: row.coverUrl == null ? null : String(row.coverUrl),
    durationSeconds: Number(row.duration || 0),
    publishedAt: new Date(row.publishedAt).toISOString(),
    views: Number(row.playCount || 0),
    likes: Number(row.likeCount || 0),
    comments: Number(row.commentCount || 0),
    shares: Number(row.shareCount || 0),
    saves: Number(row.collectCount || 0),
    growthViews:
      Number(row.playCount || 0) -
      Number(row.firstPlayCount ?? row.playCount ?? 0),
    growthLikes:
      Number(row.likeCount || 0) -
      Number(row.firstLikeCount ?? row.likeCount ?? 0),
    growthComments:
      Number(row.commentCount || 0) -
      Number(row.firstCommentCount ?? row.commentCount ?? 0),
    growthShares:
      Number(row.shareCount || 0) -
      Number(row.firstShareCount ?? row.shareCount ?? 0),
    growthSaves:
      Number(row.collectCount || 0) -
      Number(row.firstCollectCount ?? row.collectCount ?? 0),
  }));
  return {
    providerConfigured: Boolean(process.env.RAPIDAPI_KEY?.trim()),
    accounts: accounts.map(row => ({
      accountId: Number(row.id),
      accountName: String(row.accountName),
      displayName: row.displayName == null ? null : String(row.displayName),
      profileUrl: row.profileUrl == null ? null : String(row.profileUrl),
      avatarUrl: row.avatarUrl == null ? null : String(row.avatarUrl),
      bio: row.description == null ? null : String(row.description),
      followerCount: Number(row.followerCount || 0),
      followingCount: Number(row.followingCount || 0),
      totalLikes: Number(row.totalLikes || 0),
      videoCount: Number(row.publicVideoCount || 0),
      monitorEnabled: Boolean(row.monitorEnabled),
      lastSuccessAt: row.lastPublicSyncAt
        ? new Date(row.lastPublicSyncAt).toISOString()
        : null,
      nextSyncAt: row.nextPublicSyncAt
        ? new Date(row.nextPublicSyncAt).toISOString()
        : null,
      syncStatus: String(row.publicSyncStatus || "pending"),
      lastError:
        row.publicSyncError == null ? null : String(row.publicSyncError),
    })),
    videos: mappedVideos,
    summary: mappedVideos.reduce(
      (sum, row) => ({
        posts: sum.posts + 1,
        views: sum.views + row.views,
        likes: sum.likes + row.likes,
        comments: sum.comments + row.comments,
        shares: sum.shares + row.shares,
        saves: sum.saves + row.saves,
      }),
      { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
    ),
    runs,
  };
}
