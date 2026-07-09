import type { Env } from "../../[[route]]";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
};

// ワークスペース内横断全文検索 API
export async function handleSearchWorkspace(
  request: Request,
  env: Env,
  workspaceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const queryParam = url.searchParams.get("q") || "";
    const userId = request.headers.get("X-User-Id");

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
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

    if (!queryParam.trim()) {
      return new Response(JSON.stringify({ success: true, data: { messages: [], documents: [] } }), {
        status: 200,
        headers,
      });
    }

    // 複数単語対応のFTS5用クエリ式フォーマット
    const words = queryParam.trim().split(/\s+/).filter(w => w.length > 0);
    const formattedQuery = words.map(w => `"${w}"`).join(" AND ");

    // 1. メッセージ全文検索 (閲覧可能なチャンネルのみ)
    const messageResults = await env.DB.prepare(`
      SELECT 
        m.id,
        m.channel_id as channelId,
        c.name as channelName,
        m.user_id as userId,
        u.display_name as userDisplayName,
        m.content,
        m.created_at as createdAt,
        snippet(messages_fts, 1, '<mark>', '</mark>', '...', 20) as snippet,
        (CASE WHEN pm.message_id IS NOT NULL THEN 1 ELSE 0 END) as isPinned
      FROM messages_fts fts
      INNER JOIN messages m ON fts.message_id = m.id
      INNER JOIN channels c ON m.channel_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN message_pins pm ON m.id = pm.message_id
      WHERE c.workspace_id = ?
        AND (
          c.is_private = 0 
          OR EXISTS (
            SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?
          )
        )
        AND messages_fts MATCH ?
      ORDER BY m.created_at DESC
      LIMIT 100
    `).bind(workspaceId, userId, formattedQuery).all<any>();

    // 2. ドキュメント全文検索 (閲覧可能なワークスペース/チャンネルドキュメントのみ)
    const documentResults = await env.DB.prepare(`
      SELECT 
        fts.source_type as sourceType,
        fts.source_id as sourceId,
        fts.title,
        fts.content,
        snippet(documents_fts, 3, '<mark>', '</mark>', '...', 20) as snippet
      FROM documents_fts fts
      WHERE (
        -- ワークスペースドキュメント
        (fts.source_type = 'workspace' AND fts.source_id = ?)
        OR
        -- チャンネルドキュメント
        (fts.source_type = 'channel' AND EXISTS (
          SELECT 1 FROM channels c
          WHERE c.id = fts.source_id
            AND c.workspace_id = ?
            AND (
              c.is_private = 0
              OR EXISTS (
                SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?
              )
            )
        ))
      )
      AND documents_fts MATCH ?
      LIMIT 50
    `).bind(workspaceId, workspaceId, userId, formattedQuery).all<any>();

    return new Response(JSON.stringify({
      success: true,
      data: {
        messages: messageResults.results.map((row: any) => ({
          id: row.id,
          channelId: row.channelId,
          channelName: row.channelName,
          userId: row.userId,
          userDisplayName: row.userDisplayName || "Unknown User",
          content: row.content,
          createdAt: row.createdAt,
          snippet: row.snippet || row.content,
          isPinned: !!row.isPinned,
        })),
        documents: documentResults.results.map((row: any) => ({
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          title: row.title,
          content: row.content,
          snippet: row.snippet || row.content,
        })),
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
