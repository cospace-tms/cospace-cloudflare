import type { Env } from "../[[route]]";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
};

export async function handleGetActivities(request: Request, env: Env): Promise<Response> {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // 1. 直近作成されたチャンネル
    const channelsResult = await env.DB.prepare(`
      SELECT 'channel' as type, c.id, c.workspace_id as workspaceId, c.name as title, c.description as content, c.created_at as createdAt, w.name as workspaceName, NULL as userName
      FROM channels c
      LEFT JOIN workspaces w ON c.workspace_id = w.id
      ORDER BY c.created_at DESC LIMIT 5
    `).all<any>();

    // 2. 直近作成されたタスク・イベント
    const itemsResult = await env.DB.prepare(`
      SELECT 'task' as type, i.id, i.workspace_id as workspaceId, i.title, i.description as content, i.created_at as createdAt, w.name as workspaceName, u.display_name as userName
      FROM items i
      LEFT JOIN workspaces w ON i.workspace_id = w.id
      LEFT JOIN users u ON i.creator_id = u.id
      ORDER BY i.created_at DESC LIMIT 5
    `).all<any>();

    // 3. 直近アップロードされたファイル
    const filesResult = await env.DB.prepare(`
      SELECT 'file' as type, f.id, f.workspace_id as workspaceId, f.file_name as title, f.content_type as content, f.created_at as createdAt, w.name as workspaceName, u.display_name as userName
      FROM files f
      LEFT JOIN workspaces w ON f.workspace_id = w.id
      LEFT JOIN users u ON f.uploader_id = u.id
      ORDER BY f.created_at DESC LIMIT 5
    `).all<any>();

    // マージしてソート
    const allActivities = [
      ...(channelsResult.results || []),
      ...(itemsResult.results || []),
      ...(filesResult.results || []),
    ];

    allActivities.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 最新10件を取得
    const recentActivities = allActivities.slice(0, 10);

    return new Response(JSON.stringify({ success: true, data: recentActivities }), {
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
