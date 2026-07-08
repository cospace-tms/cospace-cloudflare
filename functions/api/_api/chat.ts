import type { Env } from "../[[route]]";
import { linkFileToMessage } from "./files";
import { getSmtpSettings, sendMail } from "../_utils/smtp";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
};

// HTMLエスケープヘルパー
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 危険なURLスキームの無害化ヘルパー
function sanitizeUrl(urlStr: string | null | undefined): string | null {
  if (!urlStr) return null;
  const parsed = urlStr.trim().toLowerCase();
  if (
    parsed.startsWith("javascript:") ||
    parsed.startsWith("data:") ||
    parsed.startsWith("vbscript:")
  ) {
    return "about:blank";
  }
  return urlStr;
}

// チャンネル個別アクセス権限のチェックヘルパー
export async function canAccessChannel(env: Env, channelId: string, userId: string): Promise<boolean> {
  try {
    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, is_private as isPrivate, type, group_id as groupId FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; isPrivate: number; type: string; groupId: string | null }>();

    if (!channel) return false;

    // パブリックチャンネルなら全員OK
    if ((channel.type === 'channel' || !channel.type) && channel.isPrivate === 0) return true;

    // 自分が明示的に channel_members にいるならOK
    const isMember = await env.DB.prepare(
      "SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?"
    ).bind(channelId, userId).first();
    if (isMember) return true;

    // グループに紐づくチャンネルで、自分がそのグループのメンバーならOK
    if ((channel.type === 'channel' || !channel.type) && channel.groupId) {
      const isGroupMember = await env.DB.prepare(
        "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?"
      ).bind(channel.groupId, userId).first();
      if (isGroupMember) return true;
    }

    // ワークスペースのオーナー(owner)なら、DM以外の通常チャンネルはOK
    if (channel.type === 'channel' || !channel.type) {
      const member = await env.DB.prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
      ).bind(channel.workspaceId, userId).first<{ role: string }>();
      if (member?.role === 'owner') return true;
    }

    return false;
  } catch {
    return false;
  }
}

// メンション/DMによる通知レコードを作成するヘルパー
async function createMessageNotifications(
  env: Env,
  messageId: string,
  channelId: string,
  senderId: string,
  content: string
): Promise<void> {
  try {
    // チャンネルの最終更新日時を更新
    await env.DB.prepare(
      "UPDATE channels SET updated_at = datetime('now') WHERE id = ?"
    ).bind(channelId).run();

    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, name, type, is_private as isPrivate FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; name: string; type: string; isPrivate: number }>();

    if (!channel) return;

    const sender = await env.DB.prepare(
      "SELECT display_name FROM users WHERE id = ?"
    ).bind(senderId).first<{ display_name: string }>();
    const senderName = sender?.display_name || "誰か";

    if (channel.type === "dm") {
      const { results: members } = await env.DB.prepare(
        "SELECT user_id as userId FROM channel_members WHERE channel_id = ? AND user_id != ?"
      ).bind(channelId, senderId).all<{ userId: string }>();

      const batch = members.map(m => {
        const notificationId = crypto.randomUUID();
        const title = `${senderName}さんからのダイレクトメッセージ`;
        const linkUrl = `/channels/${channelId}?msg=${messageId}`;
        return env.DB.prepare(
          "INSERT INTO notifications (id, workspace_id, user_id, sender_id, type, title, content, link_url) VALUES (?, ?, ?, ?, 'dm', ?, ?, ?)"
        ).bind(notificationId, channel.workspaceId, m.userId, senderId, title, content.substring(0, 100), linkUrl);
      });

      if (batch.length > 0) {
        await env.DB.batch(batch);
      }
      return;
    }

    const { results: wsMembers } = await env.DB.prepare(
      "SELECT u.id as userId, u.display_name as displayName FROM workspace_members wm JOIN users u ON wm.user_id = u.id WHERE wm.workspace_id = ?"
    ).bind(channel.workspaceId).all<{ userId: string; displayName: string }>();

    const targetUserIds = new Set<string>();

    if (content.includes("@all")) {
      wsMembers.forEach(m => {
        if (m.userId !== senderId) {
          targetUserIds.add(m.userId);
        }
      });
    } else {
      wsMembers.forEach(m => {
        if (m.userId !== senderId && content.includes(`@${m.displayName}`)) {
          targetUserIds.add(m.userId);
        }
      });
    }

    const batch = Array.from(targetUserIds).map(userId => {
      const notificationId = crypto.randomUUID();
      const title = `#${channel.name} でメンションされました`;
      const linkUrl = `/channels/${channelId}?msg=${messageId}`;
      return env.DB.prepare(
        "INSERT INTO notifications (id, workspace_id, user_id, sender_id, type, title, content, link_url) VALUES (?, ?, ?, ?, 'mention', ?, ?, ?)"
      ).bind(notificationId, channel.workspaceId, userId, senderId, title, content.substring(0, 100), linkUrl);
    });

    if (batch.length > 0) {
      await env.DB.batch(batch);
    }
  } catch (err) {
    console.error("Failed to create message notifications:", err);
  }
}

export async function handleGetWorkspaces(request: Request, env: Env): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");

    let query = `
      SELECT 
        w.*,
        COALESCE(n.unread_count, 0) as unreadCount
      FROM workspaces w
      LEFT JOIN (
        SELECT workspace_id, COUNT(*) as unread_count 
        FROM notifications 
        WHERE user_id = ? AND is_read = 0 AND is_archived = 0
        GROUP BY workspace_id
      ) n ON w.id = n.workspace_id
      ORDER BY w.created_at ASC
    `;

    const { results } = await env.DB.prepare(query)
      .bind(userId || "")
      .all();

    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleCreateWorkspace(request: Request, env: Env): Promise<Response> {
  try {
    const body: any = await request.json();
    const { name } = body;
    if (!name) {
      return new Response(JSON.stringify({ error: "Workspace name is required" }), {
        status: 400,
        headers,
      });
    }

    const workspaceId = crypto.randomUUID();
    const defaultChannelId = crypto.randomUUID();
    const userId = request.headers.get("X-User-Id");

    const insertWorkspace = env.DB.prepare(
      "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    ).bind(workspaceId, name);

    const insertChannel = env.DB.prepare(
      "INSERT INTO channels (id, workspace_id, name, description, is_private, type, created_at, updated_at) VALUES (?, ?, 'general', '全メンバーが参加するデフォルトのチャンネルです', 0, 'channel', datetime('now'), datetime('now'))"
    ).bind(defaultChannelId, workspaceId);

    const batch = [insertWorkspace, insertChannel];

    if (userId) {
      const insertMember = env.DB.prepare(
        "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at, updated_at) VALUES (?, ?, 'owner', datetime('now'), datetime('now'))"
      ).bind(workspaceId, userId);
      batch.push(insertMember);
    }

    await env.DB.batch(batch);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: workspaceId,
        name: name,
      }
    }), {
      status: 201,
      headers,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleGetChannels(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // ユーザーのワークスペース内のロールを取得
    const member = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first<{ role: string }>();

    const userRole = member?.role || 'member';

    let results;
    if (userRole === 'guest') {
      // ゲストの場合は、自分が明示的にメンバーになっているチャンネルのみ（DMは除外）
      const queryResult = await env.DB.prepare(`
        SELECT c.* FROM channels c
        WHERE c.workspace_id = ?
          AND (c.type = 'channel' OR c.type IS NULL)
          AND EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?)
        ORDER BY c.created_at ASC
      `).bind(workspaceId, userId).all<any>();
      results = queryResult.results;
    } else {
      // 閲覧権限があるチャンネルのみを取得するSQL
      const queryResult = await env.DB.prepare(`
        SELECT c.* FROM channels c
        WHERE c.workspace_id = ?
          AND (
            -- 1. デフォルトルーム: general パブリックチャンネル
            ((c.type = 'channel' OR c.type IS NULL) AND c.is_private = 0 AND c.name = 'general')
            OR
            -- 2. 自分が明示的にメンバーになっているチャンネル/DM
            EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?)
          )
        ORDER BY c.created_at ASC
      `).bind(workspaceId, userId).all<any>();
      results = queryResult.results;
    }

    const data = results.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      isPrivate: row.is_private === 1,
      description: row.description,
      type: row.type || 'channel',
      groupId: row.group_id || null,
      updatedAt: row.updated_at || null,
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleCreateChannel(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { name, description, isPrivate, groupId, type, memberIds } = body;

    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const creator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first<{ role: string }>();

    const channelType = type || 'channel';

    if (channelType === 'dm') {
      if (creator?.role === 'guest') {
        return new Response(JSON.stringify({ error: "Guests are not allowed to start DMs" }), {
          status: 403,
          headers,
        });
      }
      if (Array.isArray(memberIds)) {
        for (const mId of memberIds) {
          const mem = await env.DB.prepare(
            "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
          ).bind(workspaceId, mId).first<{ role: string }>();
          if (mem?.role === 'guest') {
            return new Response(JSON.stringify({ error: "Cannot start DM with a guest user" }), {
              status: 403,
              headers,
            });
          }
        }
      }
    }

    // 既に同じ組み合わせの1対1 DMが存在するかチェックする
    if (channelType === 'dm' && Array.isArray(memberIds) && memberIds.length === 2) {
      const existingDm = await env.DB.prepare(`
        SELECT cm1.channel_id
        FROM channel_members cm1
        JOIN channel_members cm2 ON cm1.channel_id = cm2.channel_id
        JOIN channels c ON cm1.channel_id = c.id
        WHERE c.type = 'dm'
          AND cm1.user_id = ?
          AND cm2.user_id = ?
          AND (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) = 2
      `).bind(memberIds[0], memberIds[1]).first<{ channel_id: string }>();

      if (existingDm) {
        const ch = await env.DB.prepare("SELECT * FROM channels WHERE id = ?").bind(existingDm.channel_id).first<{ id: string; name: string }>();
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: ch?.id,
            workspaceId,
            name: ch?.name,
            isPrivate: true,
            type: 'dm'
          }
        }), {
          status: 200,
          headers,
        });
      }
    }

    const channelId = crypto.randomUUID();
    const isPrivateInt = (isPrivate || channelType === 'dm') ? 1 : 0;

    await env.DB.prepare(
      "INSERT INTO channels (id, workspace_id, name, description, is_private, type, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(channelId, workspaceId, name || "DM", description || "", isPrivateInt, channelType, groupId || null).run();

    // 参加ユーザーを設定（作成者自身も自動登録）
    const assignedMemberIds = new Set<string>();
    if (Array.isArray(memberIds)) {
      memberIds.forEach(id => assignedMemberIds.add(id));
    }
    assignedMemberIds.add(userId);

    const batch = Array.from(assignedMemberIds).map(uid =>
      env.DB.prepare("INSERT INTO channel_members (channel_id, user_id, created_at) VALUES (?, ?, datetime('now'))").bind(channelId, uid)
    );
    await env.DB.batch(batch);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: channelId,
        workspaceId,
        name: name || "DM",
        description,
        isPrivate: isPrivateInt === 1,
        type: channelType,
        groupId: groupId || null,
      }
    }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleGetMessages(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const since = url.searchParams.get("since");
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 認可チェック
    const hasAccess = await canAccessChannel(env, channelId, userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    let query = `
      SELECT 
        m.id, 
        m.channel_id as channelId, 
        m.user_id as userId, 
        m.parent_id as parentId, 
        m.content, 
        m.file_url as fileUrl, 
        m.file_name as fileName, 
        m.file_size as fileSize, 
        m.created_at as createdAt,
        u.display_name as userDisplayName,
        u.avatar_url as userAvatarUrl,
        pm.content as parentContent,
        pu.display_name as parentUserDisplayName,
        (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as replyCount,
        (SELECT MAX(created_at) FROM messages r WHERE r.parent_id = m.id) as lastReplyAt,
        (
          SELECT json_group_array(
            json_object(
              'id', r.id,
              'emoji', r.emoji,
              'userId', r.user_id,
              'displayName', ru.display_name
            )
          )
          FROM reactions r
          LEFT JOIN users ru ON r.user_id = ru.id
          WHERE r.message_id = m.id
        ) as reactionsJson
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN messages pm ON m.parent_id = pm.id
      LEFT JOIN users pu ON pm.user_id = pu.id
      WHERE m.channel_id = ?
    `;

    const params: any[] = [channelId];

    if (since) {
      query += " AND m.created_at > ?";
      params.push(since);
    }

    query += " ORDER BY m.created_at ASC";

    const { results } = await env.DB.prepare(query).bind(...params).all<any>();

    const data = results.map((row: any) => ({
      id: row.id,
      channelId: row.channelId,
      userId: row.userId,
      parentId: row.parentId,
      parentMessage: row.parentId ? {
        content: row.parentContent || '',
        userDisplayName: row.parentUserDisplayName || 'Unknown User',
      } : null,
      content: row.content,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      fileSize: row.fileSize,
      status: 'sent',
      createdAt: row.createdAt,
      user: {
        id: row.userId,
        displayName: row.userDisplayName || 'Unknown User',
        avatarUrl: row.userAvatarUrl || undefined,
      },
      replyCount: row.replyCount || 0,
      lastReplyAt: row.lastReplyAt || null,
      reactions: row.reactionsJson ? JSON.parse(row.reactionsJson) : [],
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleCreateMessage(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 認可チェック
    const hasAccess = await canAccessChannel(env, channelId, userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    const body: any = await request.json();
    const { content, parentId, fileUrl, fileName, fileSize } = body;

    if (!content) {
      return new Response(JSON.stringify({ error: "Message content is required" }), {
        status: 400,
        headers,
      });
    }

    const sanitizedContent = escapeHtml(content);
    const sanitizedFileUrl = sanitizeUrl(fileUrl);

    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO messages (id, channel_id, user_id, parent_id, content, file_url, file_name, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(messageId, channelId, userId, parentId || null, sanitizedContent, sanitizedFileUrl, fileName || null, fileSize || null, createdAt, createdAt).run();

    // 添付ファイルをメディアライブラリ（filesテーブル）に登録・更新
    await linkFileToMessage(env, sanitizedFileUrl, fileName, fileSize, channelId, messageId, userId);

    // 非同期で通知を作成（バックグラウンド実行）
    createMessageNotifications(env, messageId, channelId, userId, sanitizedContent).catch(err => {
      console.error("Failed to create message notifications:", err);
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: messageId,
        createdAt,
      }
    }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleGetMessagesGeneral(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const channelId = url.searchParams.get("channel_id") || url.searchParams.get("channelId");
    const lastId = url.searchParams.get("last_id") || url.searchParams.get("lastId");
    const userId = request.headers.get("X-User-Id");

    if (!channelId) {
      return new Response(JSON.stringify({ error: "channel_id is required" }), {
        status: 400,
        headers,
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 認可チェック
    const hasAccess = await canAccessChannel(env, channelId, userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    let query = `
      SELECT 
        m.id, 
        m.channel_id as channelId, 
        m.user_id as userId, 
        m.parent_id as parentId, 
        m.content, 
        m.file_url as fileUrl, 
        m.file_name as fileName, 
        m.file_size as fileSize, 
        m.created_at as createdAt,
        u.display_name as userDisplayName,
        u.avatar_url as userAvatarUrl,
        pm.content as parentContent,
        pu.display_name as parentUserDisplayName,
        (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as replyCount,
        (SELECT MAX(created_at) FROM messages r WHERE r.parent_id = m.id) as lastReplyAt,
        (
          SELECT json_group_array(
            json_object(
              'id', r.id,
              'emoji', r.emoji,
              'userId', r.user_id,
              'displayName', ru.display_name
            )
          )
          FROM reactions r
          LEFT JOIN users ru ON r.user_id = ru.id
          WHERE r.message_id = m.id
        ) as reactionsJson
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN messages pm ON m.parent_id = pm.id
      LEFT JOIN users pu ON pm.user_id = pu.id
      WHERE m.channel_id = ?
    `;

    const params: any[] = [channelId];

    if (lastId) {
      const lastMsg = await env.DB.prepare(
        "SELECT created_at FROM messages WHERE id = ?"
      ).bind(lastId).first<{ created_at: string }>();

      if (lastMsg) {
        query += " AND m.created_at > ?";
        params.push(lastMsg.created_at);
      }
    }

    query += " ORDER BY m.created_at ASC";

    const { results } = await env.DB.prepare(query).bind(...params).all<any>();

    const data = results.map((row: any) => ({
      id: row.id,
      channelId: row.channelId,
      userId: row.userId,
      parentId: row.parentId,
      parentMessage: row.parentId ? {
        content: row.parentContent || '',
        userDisplayName: row.parentUserDisplayName || 'Unknown User',
      } : null,
      content: row.content,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      fileSize: row.fileSize,
      status: 'sent',
      createdAt: row.createdAt,
      user: {
        id: row.userId,
        displayName: row.userDisplayName || 'Unknown User',
        avatarUrl: row.userAvatarUrl || undefined,
      },
      replyCount: row.replyCount || 0,
      lastReplyAt: row.lastReplyAt || null,
      reactions: row.reactionsJson ? JSON.parse(row.reactionsJson) : [],
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleCreateMessageGeneral(request: Request, env: Env): Promise<Response> {
  try {
    const body: any = await request.json();
    const { content, parentId, fileUrl, fileName, fileSize } = body;
    const channelId = body.channelId || body.channel_id;
    const userId = request.headers.get("X-User-Id");

    if (!channelId) {
      return new Response(JSON.stringify({ error: "channelId is required" }), {
        status: 400,
        headers,
      });
    }

    if (!content) {
      return new Response(JSON.stringify({ error: "Message content is required" }), {
        status: 400,
        headers,
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 認可チェック
    const hasAccess = await canAccessChannel(env, channelId, userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    const sanitizedContent = escapeHtml(content);
    const sanitizedFileUrl = sanitizeUrl(fileUrl);

    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO messages (id, channel_id, user_id, parent_id, content, file_url, file_name, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(messageId, channelId, userId, parentId || null, sanitizedContent, sanitizedFileUrl, fileName || null, fileSize || null, createdAt, createdAt).run();

    // 添付ファイルをメディアライブラリ（filesテーブル）に登録・更新
    await linkFileToMessage(env, sanitizedFileUrl, fileName, fileSize, channelId, messageId, userId);

    // 非同期で通知を作成（バックグラウンド実行）
    createMessageNotifications(env, messageId, channelId, userId, sanitizedContent).catch(err => {
      console.error("Failed to create message notifications:", err);
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: messageId,
        createdAt,
      }
    }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 絵文字リアクションの追加/削除（トグル）API
export async function handleToggleReaction(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/messages\/([^\/]+)\/reactions$/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid reaction URL" }), {
        status: 400,
        headers,
      });
    }
    const messageId = match[1];

    const body: any = await request.json();
    const { emoji } = body;
    const userId = request.headers.get("X-User-Id");

    if (!emoji) {
      return new Response(JSON.stringify({ error: "Emoji is required" }), {
        status: 400,
        headers,
      });
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // メッセージが属するチャンネルIDと送信者を引いて認可チェック
    const msg = await env.DB.prepare(
      "SELECT channel_id as channelId, user_id as messageUserId FROM messages WHERE id = ?"
    ).bind(messageId).first<{ channelId: string; messageUserId: string }>();

    if (!msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers,
      });
    }

    if (msg.messageUserId === userId) {
      return new Response(JSON.stringify({ error: "Cannot react to your own message" }), {
        status: 400,
        headers,
      });
    }

    const hasAccess = await canAccessChannel(env, msg.channelId, userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    // 既存の同一リアクションをチェック
    const existing = await env.DB.prepare(
      "SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?"
    ).bind(messageId, userId, emoji).first();

    if (existing) {
      // 存在すれば削除（トグルオフ）
      await env.DB.prepare(
        "DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?"
      ).bind(messageId, userId, emoji).run();

      return new Response(JSON.stringify({ success: true, action: "removed" }), {
        status: 200,
        headers,
      });
    } else {
      // 存在しなければ新規登録（トグルオン）
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      ).bind(id, messageId, userId, emoji).run();

      return new Response(JSON.stringify({ success: true, action: "added" }), {
        status: 201,
        headers,
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ユーザープロフィール更新 API
export async function handleUpdateUser(request: Request, env: Env): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const body: any = await request.json();
    const { displayName, avatarUrl, language } = body;

    if (!displayName) {
      return new Response(JSON.stringify({ error: "Display name is required" }), {
        status: 400,
        headers,
      });
    }

    await env.DB.prepare(
      "UPDATE users SET display_name = ?, avatar_url = ?, language = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(displayName, avatarUrl || null, language || 'ja', userId).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: userId,
        displayName,
        avatarUrl,
        language: language || 'ja'
      }
    }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ワークスペース更新 API
export async function handleUpdateWorkspace(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { name, customStatuses } = body;

    if (!name && customStatuses === undefined) {
      return new Response(JSON.stringify({ error: "Missing fields to update" }), {
        status: 400,
        headers,
      });
    }

    let updateFields = "updated_at = datetime('now')";
    const params: any[] = [];

    if (name !== undefined) {
      updateFields += ", name = ?";
      params.push(name);
    }
    if (customStatuses !== undefined) {
      updateFields += ", custom_statuses = ?";
      params.push(customStatuses);
    }

    params.push(workspaceId);

    await env.DB.prepare(
      `UPDATE workspaces SET ${updateFields} WHERE id = ?`
    ).bind(...params).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: workspaceId,
        name,
        customStatuses,
      }
    }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ワークスペース削除 API
export async function handleDeleteWorkspace(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    await env.DB.prepare(
      "DELETE FROM workspaces WHERE id = ?"
    ).bind(workspaceId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// チャンネル更新 API
export async function handleUpdateChannel(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { name, description, isPrivate } = body;
    const operatorId = request.headers.get("X-User-Id");

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // チャンネルと所属ワークスペースの取得
    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, is_private as isPrivate, type, group_id as groupId FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; isPrivate: number; type: string; groupId: string | null }>();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers,
      });
    }

    // DM の場合はパブリック化（isPrivate = false）を拒否
    if (channel.type === 'dm' && isPrivate === false) {
      return new Response(JSON.stringify({ error: "DM cannot be made public" }), {
        status: 400,
        headers,
      });
    }

    // 操作者のロールを取得
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(channel.workspaceId, operatorId).first<{ role: string }>();

    if (!operator) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    const isOwner = operator.role === 'owner';
    const isGroupAdmin = operator.role === 'group_admin';

    let hasPermission = isOwner;

    // グループ管理者の場合、このチャンネルが自分の管理する（リーダーである）グループに属しているかチェック
    if (isGroupAdmin && channel.groupId) {
      const isLeader = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND user_id = ? AND is_leader = 1"
      ).bind(channel.groupId, operatorId).first<{ count: number }>();

      if (isLeader && isLeader.count > 0) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    const isPrivateInt = isPrivate !== undefined ? (isPrivate ? 1 : 0) : channel.isPrivate;

    await env.DB.prepare(
      "UPDATE channels SET name = ?, description = ?, is_private = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(name || "", description || "", isPrivateInt, channelId).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: channelId,
        name: name || "",
        description: description || "",
        isPrivate: isPrivateInt === 1,
      }
    }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// チャンネル削除 API
export async function handleDeleteChannel(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const operatorId = request.headers.get("X-User-Id");

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // チャンネルと所属ワークスペースの取得
    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, group_id as groupId FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; groupId: string | null }>();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers,
      });
    }

    // 操作者のロールを取得
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(channel.workspaceId, operatorId).first<{ role: string }>();

    if (!operator) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    const isOwner = operator.role === 'owner';
    const isGroupAdmin = operator.role === 'group_admin';

    let hasPermission = isOwner;

    // グループ管理者の場合、このチャンネルが自分の管理する（リーダーである）グループに属しているかチェック
    if (isGroupAdmin && channel.groupId) {
      const isLeader = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND user_id = ? AND is_leader = 1"
      ).bind(channel.groupId, operatorId).first<{ count: number }>();

      if (isLeader && isLeader.count > 0) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    await env.DB.prepare(
      "DELETE FROM channels WHERE id = ?"
    ).bind(channelId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ワークスペースメンバー一覧取得 API
export async function handleGetWorkspaceMembers(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const operatorId = request.headers.get("X-User-Id");
    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, operatorId).first<{ role: string }>();

    if (!operator || operator.role === 'guest') {
      return new Response(JSON.stringify({ error: "Permission denied for guests" }), {
        status: 403,
        headers,
      });
    }

    const { results } = await env.DB.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        wm.role,
        (
          SELECT json_group_array(group_id) 
          FROM group_members 
          WHERE user_id = u.id
        ) as groupIdsJson
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at ASC
    `).bind(workspaceId).all<any>();

    const data = results.map(r => ({
      ...r,
      groupIds: r.groupIdsJson ? JSON.parse(r.groupIdsJson) : []
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// メンバー追加 API
export async function handleAddWorkspaceMember(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { email, role } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers,
      });
    }

    const memberRole = role || 'member';

    // 既存ユーザーを検索
    let user = await env.DB.prepare(
      "SELECT id, email, display_name as displayName, avatar_url as avatarUrl FROM users WHERE email = ?"
    ).bind(email).first<{ id: string; email: string; displayName: string; avatarUrl: string | null }>();

    let userId = user?.id;

    if (!user) {
      // 存在しない場合は仮パスワードで自動生成
      userId = crypto.randomUUID();
      const displayName = email.split('@')[0];
      const tempHash = "pbkdf2$100000$0000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

      await env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, display_name, language, created_at, updated_at) VALUES (?, ?, ?, ?, 'ja', datetime('now'), datetime('now'))"
      ).bind(userId, email, tempHash, displayName).run();
    }

    // 重複チェック
    const existingMember = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first();

    if (existingMember) {
      return new Response(JSON.stringify({ error: "User is already a member of this workspace" }), {
        status: 400,
        headers,
      });
    }

    // メンバーとしてインサート
    await env.DB.prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(workspaceId, userId, memberRole).run();

    // 招待メールの送信（SMTP設定が有効な場合のみ）
    const smtpSettings = await getSmtpSettings(env);
    if (smtpSettings) {
      try {
        const workspace = await env.DB.prepare(
          "SELECT name FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first<{ name: string }>();
        const workspaceName = workspace?.name || "Cospace";

        const url = new URL(request.url);
        const loginUrl = `${url.protocol}//${url.host}`;

        await sendMail(smtpSettings, {
          to: email,
          subject: `[Cospace] ${workspaceName} ワークスペースへの招待`,
          text: `こんにちは。\r\n\r\n${workspaceName} ワークスペースへの招待が届きました。\r\n以下のリンクからログインしてください。\r\n\r\nログインURL: ${loginUrl}\r\n\r\n※初めてのログインの際は、管理者から発行された初期パスワードをご使用ください。ログイン後、右上の設定よりパスワードの変更をお願いいたします。`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Cospace 招待のお知らせ</h2>
              <p>こんにちは。</p>
              <p><strong>${workspaceName}</strong> ワークスペースへの招待が届きました。</p>
              <div style="margin: 25px 0;">
                <a href="${loginUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Cospace にログインする
                </a>
              </div>
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; border-top: 1px solid #eee; padding-top: 15px;">
                ※初めてログインする場合は、管理者から発行された初期パスワードをご入力ください。ログイン後、右上メニューの「設定」からパスワードを新しいものへ変更することをお勧めします。
              </p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error("Failed to send invitation email:", mailErr);
      }
    }

    const addedUser = await env.DB.prepare(
      "SELECT id as userId, email, display_name as displayName, avatar_url as avatarUrl FROM users WHERE id = ?"
    ).bind(userId).first<any>();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...addedUser,
        role: memberRole
      }
    }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// メンバーロール更新 API
export async function handleUpdateWorkspaceMember(request: Request, env: Env, workspaceId: string, userId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { role } = body;
    const operatorId = request.headers.get("X-User-Id");

    if (!role || !['owner', 'group_admin', 'member', 'guest'].includes(role)) {
      return new Response(JSON.stringify({ error: "Valid role is required" }), {
        status: 400,
        headers,
      });
    }

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 操作者のロールを取得
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, operatorId).first<{ role: string }>();

    if (!operator) {
      return new Response(JSON.stringify({ error: "Operator not found in workspace" }), {
        status: 403,
        headers,
      });
    }

    const isOperatorOwner = operator.role === 'owner';
    const isOperatorGroupAdmin = operator.role === 'group_admin';

    if (!isOperatorOwner && !isOperatorGroupAdmin) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    // グループ管理者の場合、対象ユーザーが「自分がリーダーを務めるグループ」の所属メンバーであるかをチェック
    if (isOperatorGroupAdmin) {
      const leaderGroups = await env.DB.prepare(`
        SELECT group_id FROM group_members WHERE user_id = ? AND is_leader = 1
      `).bind(operatorId).all<{ group_id: string }>();

      const groupIds = leaderGroups.results.map(g => g.group_id);
      if (groupIds.length === 0) {
        return new Response(JSON.stringify({ error: "Permission denied (Not leading any group)" }), {
          status: 403,
          headers,
        });
      }

      // 対象ユーザーがグループに属しているかプレースホルダーバインドで確認
      const placeholders = groupIds.map(() => '?').join(',');
      const isTargetInGroup = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM group_members 
        WHERE user_id = ? AND group_id IN (${placeholders})
      `).bind(userId, ...groupIds).first<{ count: number }>();

      if (!isTargetInGroup || isTargetInGroup.count === 0) {
        return new Response(JSON.stringify({ error: "Permission denied (Target user not in led groups)" }), {
          status: 403,
          headers,
        });
      }

      // グループ管理者は owner に昇格させることはできない
      if (role === 'owner') {
        return new Response(JSON.stringify({ error: "Permission denied (Cannot promote to owner)" }), {
          status: 403,
          headers,
        });
      }

      // 対象ユーザーが owner の場合は降格できない
      const target = await env.DB.prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
      ).bind(workspaceId, userId).first<{ role: string }>();
      if (target?.role === 'owner') {
        return new Response(JSON.stringify({ error: "Permission denied (Cannot downgrade owner)" }), {
          status: 403,
          headers,
        });
      }
    }

    await env.DB.prepare(
      "UPDATE workspace_members SET role = ?, updated_at = datetime('now') WHERE workspace_id = ? AND user_id = ?"
    ).bind(role, workspaceId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// メンバー削除 API
export async function handleDeleteWorkspaceMember(request: Request, env: Env, workspaceId: string, userId: string): Promise<Response> {
  try {
    const operatorId = request.headers.get("X-User-Id");

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 操作者のロールを取得
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, operatorId).first<{ role: string }>();

    if (!operator) {
      return new Response(JSON.stringify({ error: "Operator not found in workspace" }), {
        status: 403,
        headers,
      });
    }

    const isOperatorOwner = operator.role === 'owner';
    const isOperatorGroupAdmin = operator.role === 'group_admin';

    if (!isOperatorOwner && !isOperatorGroupAdmin) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    // グループ管理者の場合、対象ユーザーが「自分がリーダーを務めるグループ」の所属メンバーであるかをチェック
    if (isOperatorGroupAdmin) {
      const leaderGroups = await env.DB.prepare(`
        SELECT group_id FROM group_members WHERE user_id = ? AND is_leader = 1
      `).bind(operatorId).all<{ group_id: string }>();

      const groupIds = leaderGroups.results.map(g => g.group_id);
      if (groupIds.length === 0) {
        return new Response(JSON.stringify({ error: "Permission denied (Not leading any group)" }), {
          status: 403,
          headers,
        });
      }

      const placeholders = groupIds.map(() => '?').join(',');
      const isTargetInGroup = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM group_members 
        WHERE user_id = ? AND group_id IN (${placeholders})
      `).bind(userId, ...groupIds).first<{ count: number }>();

      if (!isTargetInGroup || isTargetInGroup.count === 0) {
        return new Response(JSON.stringify({ error: "Permission denied (Target user not in led groups)" }), {
          status: 403,
          headers,
        });
      }

      // 対象ユーザーが owner の場合は除外できない
      const target = await env.DB.prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
      ).bind(workspaceId, userId).first<{ role: string }>();
      if (target?.role === 'owner') {
        return new Response(JSON.stringify({ error: "Permission denied (Cannot remove owner)" }), {
          status: 403,
          headers,
        });
      }
    }

    await env.DB.prepare(
      "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ログインユーザーのワークスペースにおけるロール取得 API
export async function handleGetWorkspaceUserRole(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const member = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first<{ role: string }>();

    // ユーザーがリーダーを務めるグループのID一覧も一緒に返却する
    const leaderGroups = await env.DB.prepare(
      "SELECT group_id as groupId FROM group_members WHERE user_id = ? AND is_leader = 1"
    ).bind(userId).all<{ groupId: string }>();

    return new Response(JSON.stringify({
      success: true,
      role: member?.role || 'member',
      ledGroups: leaderGroups.results.map(g => g.groupId)
    }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループ一覧取得 API
export async function handleGetGroups(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
        status: 400,
        headers,
      });
    }

    const { results } = await env.DB.prepare(`
      SELECT 
        g.id,
        g.name,
        g.is_private as isPrivate,
        g.created_at as createdAt,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as memberCount
      FROM groups g
      WHERE g.workspace_id = ?
      ORDER BY g.created_at ASC
    `).bind(workspaceId).all<any>();

    const data = results.map((row: any) => ({
      id: row.id,
      name: row.name,
      isPrivate: row.isPrivate === 1,
      createdAt: row.createdAt,
      memberCount: row.memberCount
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループ作成 API
export async function handleCreateGroup(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { name, isPrivate } = body;

    if (!name || !workspaceId) {
      return new Response(JSON.stringify({ error: "name and workspaceId are required" }), {
        status: 400,
        headers,
      });
    }

    const isPrivateInt = isPrivate ? 1 : 0;
    const groupId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO groups (id, workspace_id, name, is_private, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(groupId, workspaceId, name, isPrivateInt).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: groupId,
        name,
        isPrivate: isPrivateInt === 1,
        memberCount: 0,
      }
    }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループ更新 API
export async function handleUpdateGroup(request: Request, env: Env, groupId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { name, isPrivate } = body;
    const operatorId = request.headers.get("X-User-Id");

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers,
      });
    }

    // グループが属する workspaceId を取得
    const group = await env.DB.prepare(
      "SELECT workspace_id as workspaceId FROM groups WHERE id = ?"
    ).bind(groupId).first<{ workspaceId: string }>();

    if (!group) {
      return new Response(JSON.stringify({ error: "Group not found" }), {
        status: 404,
        headers,
      });
    }

    // 操作者のロールを取得
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(group.workspaceId, operatorId).first<{ role: string }>();

    if (!operator) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    let hasPermission = operator.role === 'owner';

    // グループ管理者 (group_admin) の場合、そのグループのリーダー (is_leader = 1) であるか確認
    if (operator.role === 'group_admin') {
      const isLeader = await env.DB.prepare(
        "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND is_leader = 1"
      ).bind(groupId, operatorId).first();
      if (isLeader) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    const isPrivateInt = isPrivate !== undefined ? (isPrivate ? 1 : 0) : null;

    if (isPrivateInt !== null) {
      await env.DB.prepare(
        "UPDATE groups SET name = ?, is_private = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(name, isPrivateInt, groupId).run();
    } else {
      await env.DB.prepare(
        "UPDATE groups SET name = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(name, groupId).run();
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: groupId,
        name,
        isPrivate: isPrivateInt === 1
      }
    }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループ削除 API
export async function handleDeleteGroup(request: Request, env: Env, groupId: string): Promise<Response> {
  try {
    await env.DB.prepare(
      "DELETE FROM groups WHERE id = ?"
    ).bind(groupId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループメンバー一覧取得 API
export async function handleGetGroupMembers(request: Request, env: Env, groupId: string): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        gm.is_leader as isLeader
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.created_at ASC
    `).bind(groupId).all<any>();

    const data = results.map(r => ({
      ...r,
      isLeader: r.isLeader === 1,
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループメンバー追加 API
export async function handleAddGroupMember(request: Request, env: Env, groupId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { userId, isLeader } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers,
      });
    }

    const leaderVal = isLeader ? 1 : 0;

    // 重複チェック
    const existing = await env.DB.prepare(
      "SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?"
    ).bind(groupId, userId).first();

    if (existing) {
      return new Response(JSON.stringify({ error: "User is already a member of this group" }), {
        status: 400,
        headers,
      });
    }

    await env.DB.prepare(
      "INSERT INTO group_members (group_id, user_id, is_leader, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(groupId, userId, leaderVal).run();

    const user = await env.DB.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.display_name as displayName,
        u.avatar_url as avatarUrl
      FROM users u
      WHERE u.id = ?
    `).bind(userId).first<any>();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...user,
        isLeader: !!isLeader
      }
    }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループメンバー更新 API
export async function handleUpdateGroupMember(request: Request, env: Env, groupId: string, userId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { isLeader } = body;

    const leaderVal = isLeader ? 1 : 0;

    await env.DB.prepare(
      "UPDATE group_members SET is_leader = ? WHERE group_id = ? AND user_id = ?"
    ).bind(leaderVal, groupId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// グループメンバー削除 API
export async function handleDeleteGroupMember(request: Request, env: Env, groupId: string, userId: string): Promise<Response> {
  try {
    await env.DB.prepare(
      "DELETE FROM group_members WHERE group_id = ? AND user_id = ?"
    ).bind(groupId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// チャンネルメンバー一覧取得 API
export async function handleGetChannelMembers(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const hasAccess = await canAccessChannel(env, channelId, userId);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    // チャンネル情報を取得して、generalチャンネル（パブリック）かどうかを判定
    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, name, is_private as isPrivate FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; name: string; isPrivate: number }>();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers,
      });
    }

    let results;
    if (channel.name === 'general' && channel.isPrivate === 0) {
      // general パブリックチャンネルの場合は、ワークスペースの全メンバーを返す
      const { results: wsMembers } = await env.DB.prepare(`
        SELECT 
          u.id as userId,
          u.email,
          u.display_name as displayName,
          u.avatar_url as avatarUrl
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = ?
        ORDER BY wm.created_at ASC
      `).bind(channel.workspaceId).all<any>();
      results = wsMembers;
    } else {
      // それ以外のチャンネル（一般のパブリック/プライベート/DM）は、実際にそのチャンネルに参加しているメンバーを返す
      const { results: chMembers } = await env.DB.prepare(`
        SELECT 
          u.id as userId,
          u.email,
          u.display_name as displayName,
          u.avatar_url as avatarUrl
        FROM channel_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.channel_id = ?
        ORDER BY cm.created_at ASC
      `).bind(channelId).all<any>();
      results = chMembers;
    }

    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// チャンネルメンバー追加 API
export async function handleAddChannelMember(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const body: any = await request.json();
    const { userId } = body;
    const operatorId = request.headers.get("X-User-Id");

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers,
      });
    }

    // チャンネルと所属ワークスペースの取得
    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, type, group_id as groupId FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; type: string; groupId: string | null }>();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers,
      });
    }

    // 認可チェック
    // 1. オーナーならOK
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(channel.workspaceId, operatorId).first<{ role: string }>();

    let hasPermission = operator?.role === 'owner';

    // 2. グループ管理者で、そのチャンネルが紐づくグループのリーダーならOK
    if (operator?.role === 'group_admin' && channel.groupId) {
      const isLeader = await env.DB.prepare(
        "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND is_leader = 1"
      ).bind(channel.groupId, operatorId).first();
      if (isLeader) {
        hasPermission = true;
      }
    }

    // 3. DMの場合、自身がメンバーなら招待可能
    if (channel.type === 'dm') {
      const isMember = await env.DB.prepare(
        "SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?"
      ).bind(channelId, operatorId).first();
      if (isMember) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    // 重複チェック
    const existing = await env.DB.prepare(
      "SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?"
    ).bind(channelId, userId).first();

    if (existing) {
      return new Response(JSON.stringify({ error: "User is already a member of this channel" }), {
        status: 400,
        headers,
      });
    }

    await env.DB.prepare(
      "INSERT INTO channel_members (channel_id, user_id, created_at) VALUES (?, ?, datetime('now'))"
    ).bind(channelId, userId).run();

    const user = await env.DB.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.display_name as displayName,
        u.avatar_url as avatarUrl
      FROM users u
      WHERE u.id = ?
    `).bind(userId).first<any>();

    return new Response(JSON.stringify({ success: true, data: user }), {
      status: 201,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// チャンネルメンバー削除 API
export async function handleDeleteChannelMember(request: Request, env: Env, channelId: string, userId: string): Promise<Response> {
  try {
    const operatorId = request.headers.get("X-User-Id");

    if (!operatorId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // チャンネルと所属ワークスペース of workspace の取得
    const channel = await env.DB.prepare(
      "SELECT workspace_id as workspaceId, type, group_id as groupId FROM channels WHERE id = ?"
    ).bind(channelId).first<{ workspaceId: string; type: string; groupId: string | null }>();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers,
      });
    }

    // 認可チェック
    const operator = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(channel.workspaceId, operatorId).first<{ role: string }>();

    let hasPermission = operator?.role === 'owner';

    if (operator?.role === 'group_admin' && channel.groupId) {
      const isLeader = await env.DB.prepare(
        "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND is_leader = 1"
      ).bind(channel.groupId, operatorId).first();
      if (isLeader) {
        hasPermission = true;
      }
    }

    if (channel.type === 'dm') {
      const isMember = await env.DB.prepare(
        "SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?"
      ).bind(channelId, operatorId).first();
      if (isMember) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers,
      });
    }

    await env.DB.prepare(
      "DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?"
    ).bind(channelId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 未参加のブラウズ可能なチャンネル一覧取得 API
export async function handleBrowseChannels(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const member = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first<{ role: string }>();

    const userRole = member?.role || 'member';

    if (userRole === 'guest') {
      return new Response(JSON.stringify({ error: "Permission denied for guests" }), {
        status: 403,
        headers,
      });
    }

    const { results } = await env.DB.prepare(`
      SELECT c.* FROM channels c
      WHERE c.workspace_id = ?
        AND (c.type = 'channel' OR c.type IS NULL)
        AND c.name != 'general'
        AND NOT EXISTS (
          SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?
        )
        AND (
          -- 1. 公開チャンネル
          c.is_private = 0
          OR
          -- 2. 所属グループに紐づくプライベートチャンネル
          (c.is_private = 1 AND c.group_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM group_members gm WHERE gm.group_id = c.group_id AND gm.user_id = ?
          ))
          OR
          -- 3. オーナーはすべてのチャンネルをブラウズ可能
          (c.is_private = 1 AND ? = 'owner')
        )
      ORDER BY c.name ASC
    `).bind(workspaceId, userId, userId, userRole).all<any>();

    const data = results.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      isPrivate: row.is_private === 1,
      description: row.description,
      type: row.type || 'channel',
      groupId: row.group_id || null,
    }));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}
