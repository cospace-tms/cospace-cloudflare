import type { Env } from "../../[[route]]";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
};

// 1. ロック状態取得 API
export async function handleGetDocumentLock(request: Request, env: Env, lockKey: string): Promise<Response> {
  try {
    const lock = await env.DB.prepare(
      "SELECT * FROM document_locks WHERE lock_key = ? AND expires_at > datetime('now')"
    ).bind(lockKey).first<{ user_id: string; user_display_name: string; expires_at: string }>();

    if (lock) {
      return new Response(
        JSON.stringify({
          success: true,
          isLocked: true,
          lockedByUserId: lock.user_id,
          lockedByUserName: lock.user_display_name,
          expiresAt: lock.expires_at,
        }),
        { status: 200, headers }
      );
    }

    return new Response(JSON.stringify({ success: true, isLocked: false }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 2. ロック取得 API
export async function handleAcquireDocumentLock(request: Request, env: Env, lockKey: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    // ロックをかけようとするユーザーの表示名を取得
    const user = await env.DB.prepare(
      "SELECT display_name FROM users WHERE id = ?"
    ).bind(userId).first<{ display_name: string }>();
    const userName = user?.display_name || "Unknown User";

    // 現在有効な他の人のロックがあるか確認
    const existingLock = await env.DB.prepare(
      "SELECT * FROM document_locks WHERE lock_key = ? AND expires_at > datetime('now')"
    ).bind(lockKey).first<{ user_id: string; user_display_name: string }>();

    if (existingLock && existingLock.user_id !== userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Document is locked by another user",
          lockedByUserName: existingLock.user_display_name,
        }),
        { status: 409, headers }
      );
    }

    // ロックを新規作成、または上書き（自分自身の既存ロックの更新、あるいは期限切れロックの置換）
    await env.DB.prepare(`
      INSERT INTO document_locks (lock_key, user_id, user_display_name, locked_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now', '+5 minutes'))
      ON CONFLICT(lock_key) DO UPDATE SET
        user_id = excluded.user_id,
        user_display_name = excluded.user_display_name,
        locked_at = excluded.locked_at,
        expires_at = excluded.expires_at
    `).bind(lockKey, userId, userName).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 3. ロック自動延長 (ハートビート) API
export async function handleHeartbeatDocumentLock(request: Request, env: Env, lockKey: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    // 自分が有効期限内のロックを持っている場合のみ延長
    const result = await env.DB.prepare(`
      UPDATE document_locks 
      SET expires_at = datetime('now', '+5 minutes')
      WHERE lock_key = ? AND user_id = ? AND expires_at > datetime('now')
    `).bind(lockKey, userId).run();

    if (result.changes === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Lock lost or expired" }),
        { status: 400, headers }
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 4. ロック解放 API
export async function handleReleaseDocumentLock(request: Request, env: Env, lockKey: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), { status: 401, headers });
    }

    // 自分が所持しているロックのみ削除
    await env.DB.prepare(
      "DELETE FROM document_locks WHERE lock_key = ? AND user_id = ?"
    ).bind(lockKey, userId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}
