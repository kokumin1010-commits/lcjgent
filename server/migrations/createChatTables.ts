import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

export async function createChatTables(db: MySql2Database<any>) {
  try {
    // チャットルーム（1対1 or グループ）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200),
        type ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
        avatarUrl TEXT,
        createdBy INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_type (type),
        INDEX idx_createdBy (createdBy)
      )
    `);

    // チャットルームメンバー
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_room_members (
        id INT PRIMARY KEY AUTO_INCREMENT,
        roomId INT NOT NULL,
        userId INT NOT NULL,
        userType ENUM('staff', 'liver') NOT NULL,
        userName VARCHAR(100),
        userAvatar TEXT,
        joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        lastReadAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_roomId (roomId),
        INDEX idx_userId_userType (userId, userType),
        UNIQUE KEY uk_room_user (roomId, userId, userType)
      )
    `);

    // チャットメッセージ
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        roomId INT NOT NULL,
        senderId INT NOT NULL,
        senderType ENUM('staff', 'liver') NOT NULL,
        senderName VARCHAR(100),
        messageType ENUM('text', 'image', 'file') NOT NULL DEFAULT 'text',
        content TEXT NOT NULL,
        fileUrl TEXT,
        fileName VARCHAR(200),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_roomId_createdAt (roomId, createdAt),
        INDEX idx_senderId (senderId, senderType)
      )
    `);

    console.log("[Migration] Chat tables (chat_rooms, chat_room_members, chat_messages) created or already exist");
  } catch (error: any) {
    console.error("[Migration] Error creating chat tables:", error.message);
  }
}
