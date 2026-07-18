import type { Env } from "../[[route]]";

const headers = {
  "Content-Type": "application/json",
};

// 1. 通知一覧取得
export async function handleGetNotifications(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "all"; // all, unread
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const isGlobal = workspaceId === "all";

    let query = `
      SELECT 
        n.id,
        n.workspace_id as workspaceId,
        n.user_id as userId,
        n.sender_id as senderId,
        n.type,
        n.title,
        n.content,
        n.link_url as linkUrl,
        n.is_read as isRead,
        n.is_archived as isArchived,
        n.created_at as createdAt,
        u.display_name as senderName,
        w.name as workspaceName
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      LEFT JOIN workspaces w ON n.workspace_id = w.id
      WHERE ${isGlobal ? "" : "n.workspace_id = ? AND "} n.user_id = ?
    `;

    if (filter === "unread") {
      query += " AND n.is_read = 0 AND n.is_archived = 0";
    } else if (filter === "archived") {
      query += " AND n.is_archived = 1";
    } else {
      query += " AND n.is_archived = 0";
    }

    query += " ORDER BY n.created_at DESC LIMIT 100";

    const bindParams = isGlobal ? [userId] : [workspaceId, userId];
    const notifications = await env.DB.prepare(query)
      .bind(...bindParams)
      .all();

    // 未アーカイブの未読件数を取得
    let countQuery = "SELECT COUNT(*) as count FROM notifications WHERE ";
    if (!isGlobal) {
      countQuery += "workspace_id = ? AND ";
    }
    countQuery += "user_id = ? AND is_read = 0 AND is_archived = 0";

    const unreadCountResult = await env.DB.prepare(countQuery)
      .bind(...bindParams)
      .first<{ count: number }>();

    return new Response(JSON.stringify({ 
      success: true, 
      data: notifications.results,
      unreadCount: unreadCountResult?.count || 0
    }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}

// 2. 個別既読化
export async function handleReadNotification(request: Request, env: Env, notificationId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    await env.DB.prepare(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
    ).bind(notificationId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}

// 3. 一括既読化
export async function handleReadAllNotifications(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    await env.DB.prepare(
      "UPDATE notifications SET is_read = 1 WHERE workspace_id = ? AND user_id = ? AND is_read = 0"
    ).bind(workspaceId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}

// 4. アーカイブ状態の更新
export async function handleArchiveNotification(request: Request, env: Env, notificationId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const body: any = await request.json();
    const isArchived = body.archive ? 1 : 0;

    await env.DB.prepare(
      "UPDATE notifications SET is_archived = ? WHERE id = ? AND user_id = ?"
    ).bind(isArchived, notificationId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}

// 5. 未読通知件数の取得
export async function handleGetUnreadNotificationsCount(request: Request, env: Env): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const result = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND is_archived = 0"
    ).bind(userId).first<{ count: number }>();

    return new Response(JSON.stringify({ 
      success: true, 
      unreadCount: result?.count || 0
    }), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}
