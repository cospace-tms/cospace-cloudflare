import type { Env } from "../../[[route]]";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
};

// ==========================================
// 1. メッセージピン留め API
// ==========================================

export async function handlePinMessage(request: Request, env: Env, messageId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    // メッセージの存在確認と channel_id の取得
    const msg = await env.DB.prepare(
      "SELECT channel_id FROM messages WHERE id = ?"
    ).bind(messageId).first<{ channel_id: string }>();

    if (!msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers });
    }

    // ピン留め登録
    await env.DB.prepare(`
      INSERT OR REPLACE INTO message_pins (message_id, channel_id, pinned_by, pinned_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(messageId, msg.channel_id, userId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleUnpinMessage(request: Request, env: Env, messageId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    await env.DB.prepare(
      "DELETE FROM message_pins WHERE message_id = ?"
    ).bind(messageId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleGetPinnedMessages(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    // ピン留めメッセージ一覧の取得 (メッセージ情報、送信者表示名、ピン留め者表示名をJOIN)
    const { results } = await env.DB.prepare(`
      SELECT 
        m.*,
        u.display_name as sender_name,
        p_u.display_name as pinned_by_name,
        mp.pinned_at
      FROM message_pins mp
      JOIN messages m ON mp.message_id = m.id
      JOIN users u ON m.user_id = u.id
      JOIN users p_u ON mp.pinned_by = p_u.id
      WHERE mp.channel_id = ?
      ORDER BY mp.pinned_at DESC
    `).bind(channelId).all<any>();

    // reactions も取得する (表示用)
    // D1.batchで一括取得
    const reactionQueries = results.map((row: any) =>
      env.DB.prepare(`
        SELECT r.emoji, r.user_id
        FROM reactions r
        WHERE r.message_id = ?
      `).bind(row.id)
    );

    let reactionsList: any[] = [];
    if (reactionQueries.length > 0) {
      reactionsList = await env.DB.batch(reactionQueries);
    }

    const data = results.map((row: any, index: number) => {
      const reactions = reactionsList[index]?.results || [];
      return {
        id: row.id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        fileUrl: row.file_url,
        fileName: row.file_name,
        fileSize: row.file_size,
        parentId: row.parent_id,
        createdAt: row.created_at,
        status: 'sent',
        user: {
          id: row.user_id,
          displayName: row.sender_name,
        },
        reactions: reactions.map((r: any) => ({
          emoji: r.emoji,
          userId: r.user_id
        })),
        pinnedBy: row.pinned_by_name,
        pinnedAt: row.pinned_at
      };
    });

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ==========================================
// 2. チャンネルお気に入り (スター) API
// ==========================================

export async function handleStarChannel(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    await env.DB.prepare(`
      INSERT OR IGNORE INTO channel_stars (user_id, channel_id, starred_at)
      VALUES (?, ?, datetime('now'))
    `).bind(userId, channelId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

export async function handleUnstarChannel(request: Request, env: Env, channelId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    await env.DB.prepare(
      "DELETE FROM channel_stars WHERE user_id = ? AND channel_id = ?"
    ).bind(userId, channelId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}
