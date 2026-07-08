import type { Env } from "../[[route]]";
import { verifyPassword, hashPassword } from "./setup";
import { signJWT, verifyJWT, getJwtSecret, serializeCookie, parseCookies } from "../_utils/jwt";

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin") || "*";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
  };

  try {
    const body: any = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers,
      });
    }



    // ユーザーを検索
    const userResult = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).bind(email).first<{
      id: string;
      email: string;
      password_hash: string;
      display_name: string;
      language?: string;
    }>();

    if (!userResult) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 401,
        headers,
      });
    }

    // パスワードの検証
    const isPasswordValid = await verifyPassword(password, userResult.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 401,
        headers,
      });
    }

    // ユーザーが所属するワークスペースを取得
    const memberResult = await env.DB.prepare(
      "SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1"
    ).bind(userResult.id).first<{ workspace_id: string }>();

    let workspaceId = memberResult?.workspace_id || "";
    let defaultChannelId = "";

    if (workspaceId) {
      // ワークスペース内のデフォルト（最初の）チャンネルを取得
      const channelResult = await env.DB.prepare(
        "SELECT id FROM channels WHERE workspace_id = ? ORDER BY created_at ASC LIMIT 1"
      ).bind(workspaceId).first<{ id: string }>();
      defaultChannelId = channelResult?.id || "";
    }

    const secret = await getJwtSecret(env);
    const accessToken = await signJWT(
      { userId: userResult.id, type: "access", exp: Math.floor(Date.now() / 1000) + 900 },
      secret
    );
    const refreshToken = await signJWT(
      { userId: userResult.id, type: "refresh", exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 },
      secret
    );

    const cookieValue = serializeCookie("refresh_token", refreshToken, {
      maxAge: 30 * 24 * 3600,
      path: "/api/auth",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    const responseHeaders = new Headers(headers);
    responseHeaders.append("Set-Cookie", cookieValue);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: userResult.id,
        displayName: userResult.display_name,
        email: userResult.email,
        workspaceId,
        defaultChannelId,
        token: accessToken,
        language: userResult.language || 'ja',
      }
    }), {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// パスワード変更 API ハンドラー
export async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin") || "*";
  const customHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  };

  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User unauthorized" }), {
        status: 401,
        headers: customHeaders,
      });
    }

    const body: any = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: "Current password and new password are required" }), {
        status: 400,
        headers: customHeaders,
      });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasNonalphas = /[^A-Za-z0-9]/.test(newPassword);

    if (newPassword.length < 8 || !(hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas)) {
      return new Response(JSON.stringify({ error: "New password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols (!@#$%^&*)." }), {
        status: 400,
        headers: customHeaders,
      });
    }

    // デモユーザーの保護
    if (userId === "demo-user-id") {
      return new Response(JSON.stringify({ error: "Demo user password cannot be changed" }), {
        status: 400,
        headers: customHeaders,
      });
    }

    // ユーザー情報の取得
    const user = await env.DB.prepare(
      "SELECT password_hash FROM users WHERE id = ?"
    ).bind(userId).first<{ password_hash: string }>();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: customHeaders,
      });
    }

    // 現在のパスワード検証
    const isPasswordValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: "Incorrect current password" }), {
        status: 400,
        headers: customHeaders,
      });
    }

    // 新しいパスワードをハッシュ化して保存
    const newHash = await hashPassword(newPassword);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(newHash, userId).run();

    return new Response(JSON.stringify({ success: true, message: "Password updated successfully" }), {
      status: 200,
      headers: customHeaders,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: customHeaders,
    });
  }
}

// セッションのサイレントリフレッシュ
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin") || "*";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const cookies = parseCookies(request);
    const refreshToken = cookies["refresh_token"];

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "Refresh token is missing" }), {
        status: 401,
        headers,
      });
    }

    const secret = await getJwtSecret(env);
    const payload = await verifyJWT(refreshToken, secret);

    if (!payload || payload.type !== "refresh" || !payload.userId) {
      return new Response(JSON.stringify({ error: "Invalid or expired refresh token" }), {
        status: 401,
        headers,
      });
    }

    const userId = payload.userId;

    // ユーザー情報とデフォルトのワークスペース・チャンネルを再取得
    const userResult = await env.DB.prepare(
      "SELECT id, email, display_name, language FROM users WHERE id = ?"
    ).bind(userId).first<{
      id: string;
      email: string;
      display_name: string;
      language?: string;
    }>();

    if (!userResult) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401,
        headers,
      });
    }

    const memberResult = await env.DB.prepare(
      "SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1"
    ).bind(userId).first<{ workspace_id: string }>();

    let workspaceId = memberResult?.workspace_id || "";
    let defaultChannelId = "";

    if (workspaceId) {
      const channelResult = await env.DB.prepare(
        "SELECT id FROM channels WHERE workspace_id = ? ORDER BY created_at ASC LIMIT 1"
      ).bind(workspaceId).first<{ id: string }>();
      defaultChannelId = channelResult?.id || "";
    }

    // 新しいアクセストークンを生成 (15分有効)
    const accessToken = await signJWT(
      { userId, type: "access", exp: Math.floor(Date.now() / 1000) + 900 },
      secret
    );

    // リフレッシュトークンもローテーション (有効期限の更新)
    const newRefreshToken = await signJWT(
      { userId, type: "refresh", exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 },
      secret
    );

    const cookieValue = serializeCookie("refresh_token", newRefreshToken, {
      maxAge: 30 * 24 * 3600,
      path: "/api/auth",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    const responseHeaders = new Headers(headers);
    responseHeaders.append("Set-Cookie", cookieValue);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: userResult.id,
        displayName: userResult.display_name,
        email: userResult.email,
        workspaceId,
        defaultChannelId,
        token: accessToken,
        language: userResult.language || 'ja',
      }
    }), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
}

// ログアウト (リフレッシュトークンCookieの削除)
export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin") || "*";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id, X-User-Id",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const cookieValue = serializeCookie("refresh_token", "", {
    maxAge: 0,
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  const responseHeaders = new Headers(headers);
  responseHeaders.append("Set-Cookie", cookieValue);

  return new Response(JSON.stringify({ success: true, message: "Logged out successfully" }), {
    status: 200,
    headers: responseHeaders,
  });
}
