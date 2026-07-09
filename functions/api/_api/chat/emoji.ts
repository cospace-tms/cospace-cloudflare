import type { Env } from "../../[[route]]";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
};

// メンバーシップ確認用ヘルパー
async function isWorkspaceMember(env: Env, workspaceId: string, userId: string): Promise<boolean> {
  const member = await env.DB.prepare(
    "SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
  ).bind(workspaceId, userId).first();
  return !!member;
}

// 1. カスタム絵文字登録 API (POST /api/workspaces/:workspaceId/emojis)
export async function handleCreateCustomEmoji(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), { status: 400, headers });
    }

    // ワークスペースの所属 ＆ 権限確認 (オーナー/グループ管理者のみアップロード可能)
    const userRole = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first<{ role: string }>();

    const isOwnerOrAdmin = userRole?.role === 'owner' || userRole?.role === 'group_admin';
    if (!isOwnerOrAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Only workspace admins can upload custom emojis" }), { status: 403, headers });
    }

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Content-Type must be multipart/form-data" }), {
        status: 400,
        headers,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawCode = formData.get("code") as string;

    if (!file || !rawCode) {
      return new Response(JSON.stringify({ error: "file and code are required" }), {
        status: 400,
        headers,
      });
    }

    // 絵文字コードの整形 (前後コロン補正)
    let code = rawCode.trim();
    if (!code.startsWith(":")) code = ":" + code;
    if (!code.endsWith(":")) code = code + ":";

    // コード名の簡易的なバリデーション (英数字とアンダースコアのみ)
    const codeName = code.slice(1, -1);
    if (!/^[a-zA-Z0-9_-]+$/.test(codeName)) {
      return new Response(JSON.stringify({ error: "Emoji code can only contain alphanumeric characters, underscores, and hyphens" }), {
        status: 400,
        headers,
      });
    }

    // 重複チェック
    const existing = await env.DB.prepare(
      "SELECT 1 FROM custom_emojis WHERE workspace_id = ? AND code = ?"
    ).bind(workspaceId, code).first();

    if (existing) {
      return new Response(JSON.stringify({ error: `Emoji code '${code}' already exists` }), {
        status: 409,
        headers,
      });
    }

    const emojiId = crypto.randomUUID();
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const objectKey = `emojis/${workspaceId}/${emojiId}${ext}`;

    // R2 に保存
    await env.BUCKET.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const url = `/api/workspaces/${workspaceId}/emojis/raw/${emojiId}${ext}`;

    // DB に登録
    await env.DB.prepare(`
      INSERT INTO custom_emojis (id, workspace_id, code, url, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(emojiId, workspaceId, code, url, userId).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: emojiId, code, url }
      }),
      { status: 201, headers }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 2. カスタム絵文字一覧取得 API (GET /api/workspaces/:workspaceId/emojis)
export async function handleGetCustomEmojis(request: Request, env: Env, workspaceId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), { status: 400, headers });
    }

    const isMember = await isWorkspaceMember(env, workspaceId, userId);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }

    const { results } = await env.DB.prepare(`
      SELECT id, code, url, created_by as createdBy, created_at as createdAt
      FROM custom_emojis
      WHERE workspace_id = ?
      ORDER BY code ASC
    `).bind(workspaceId).all<any>();

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

// 3. カスタム絵文字削除 API (DELETE /api/workspaces/:workspaceId/emojis/:emojiId)
export async function handleDeleteCustomEmoji(request: Request, env: Env, workspaceId: string, emojiId: string): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    if (!workspaceId || !emojiId) {
      return new Response(JSON.stringify({ error: "workspaceId and emojiId are required" }), {
        status: 400,
        headers,
      });
    }

    // ワークスペース所属チェック
    const isMember = await isWorkspaceMember(env, workspaceId, userId);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }

    // 絵文字レコードを引いてくる
    const emoji = await env.DB.prepare(
      "SELECT url, created_by as createdBy FROM custom_emojis WHERE id = ? AND workspace_id = ?"
    ).bind(emojiId, workspaceId).first<{ url: string; createdBy: string }>();

    if (!emoji) {
      return new Response(JSON.stringify({ error: "Emoji not found" }), { status: 404, headers });
    }

    // 権限確認: アップローダー自身、またはワークスペースのオーナー/グループ管理者のみ削除可能
    const userRole = await env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, userId).first<{ role: string }>();

    const isOwnerOrAdmin = userRole?.role === 'owner' || userRole?.role === 'group_admin';
    if (emoji.createdBy !== userId && !isOwnerOrAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Cannot delete other user's emoji" }), {
        status: 403,
        headers,
      });
    }

    // URL から R2 キーを取り出す。URL形式: /api/workspaces/:workspaceId/emojis/raw/:emojiId.ext
    // なので emojis/:workspaceId/:emojiId.ext がキーになる
    const ext = emoji.url.includes(".") ? `.${emoji.url.split(".").pop()}` : "";
    const objectKey = `emojis/${workspaceId}/${emojiId}${ext}`;

    // R2 から削除
    try {
      await env.BUCKET.delete(objectKey);
    } catch (r2Err) {
      console.warn("Failed to delete emoji object from R2 (might be already missing):", r2Err);
    }

    // DB から削除
    await env.DB.prepare("DELETE FROM custom_emojis WHERE id = ?").bind(emojiId).run();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// 4. カスタム絵文字画像プロキシ API (GET /api/workspaces/:workspaceId/emojis/raw/:emojiId)
export async function handleGetCustomEmojiRaw(request: Request, env: Env, workspaceId: string, emojiIdWithExt: string): Promise<Response> {
  try {
    // 拡張子を含んだ emojiId
    const emojiId = emojiIdWithExt.includes(".") ? emojiIdWithExt.split(".")[0] : emojiIdWithExt;

    // 絵文字の存在確認
    const emoji = await env.DB.prepare(
      "SELECT 1 FROM custom_emojis WHERE id = ? AND workspace_id = ?"
    ).bind(emojiId, workspaceId).first();

    if (!emoji) {
      return new Response("Emoji not found", { status: 404 });
    }

    const objectKey = `emojis/${workspaceId}/${emojiIdWithExt}`;

    // R2 からオブジェクト取得
    const obj = await env.BUCKET.get(objectKey);
    if (!obj) {
      return new Response("Emoji object not found in storage", { status: 404 });
    }

    const responseHeaders = new Headers();
    obj.writeHttpMetadata(responseHeaders);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(obj.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response("Internal Server Error: " + error.message, { status: 500 });
  }
}
