import { Env } from "../[[route]]";

export async function logAudit(
  env: Env,
  workspaceId: string | null,
  userId: string | null,
  action: string,
  details: any,
  request?: Request
) {
  // SaaSモードが有効な場合のみ監査ログを記録
  if (env.SAAS_MODE !== "true") {
    return;
  }

  try {
    const id = crypto.randomUUID();
    const ipAddress = request ? (request.headers.get("CF-Connecting-IP") || "127.0.0.1") : null;
    const detailsStr = typeof details === "string" ? details : JSON.stringify(details);

    await env.DB.prepare(`
      INSERT INTO audit_logs (id, workspace_id, user_id, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(id, workspaceId, userId, action, detailsStr, ipAddress).run();
  } catch (err) {
    console.error("Failed to log audit activity:", err);
  }
}
