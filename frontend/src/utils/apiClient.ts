export interface RequestOptions extends RequestInit {
  /** クエリパラメータとして付与するキーバリュー */
  params?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Cloudflare Workers (API側) と通信するための Fetch ベースの共通クライアント。
 */
export class ApiClient {
  private baseUrl: string;
  private currentWorkspaceId: string | null = null;
  private currentUserId: string | null = null;
  private currentToken: string | null = null;

  // サイレントリフレッシュ制御用の変数
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  /**
   * Cookie (HttpOnly) を使用してアクセストークンをサイレントリフレッシュします。
   */
  async refreshAccessToken(): Promise<string> {
    const base = this.baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const url = new URL("/api/auth/refresh", base);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to refresh session");
    }

    const responseData = await response.json() as any;
    if (responseData.success && responseData.data?.token) {
      const newToken = responseData.data.token;
      this.setToken(newToken);
      return newToken;
    }

    throw new Error("No token returned from refresh API");
  }

  /**
   * 現在切り替えている他社または自社のワークスペース（D1テナント）IDをセットします。
   * 以降、すべてのリクエストヘッダーに 'X-Workspace-Id' として自動的に付与されます。
   */
  setWorkspaceId(workspaceId: string | null) {
    this.currentWorkspaceId = workspaceId;
    if (workspaceId) {
      localStorage.setItem("selected_workspace_id", workspaceId);
    } else {
      localStorage.removeItem("selected_workspace_id");
    }
  }

  getWorkspaceId(): string | null {
    if (!this.currentWorkspaceId) {
      this.currentWorkspaceId = localStorage.getItem("selected_workspace_id");
    }
    return this.currentWorkspaceId;
  }

  /**
   * ログインしているユーザーのIDをセットします。
   * 以降、すべてのリクエストヘッダーに 'X-User-Id' として自動的に付与されます。
   */
  setUserId(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
      localStorage.setItem("selected_user_id", userId);
    } else {
      localStorage.removeItem("selected_user_id");
    }
  }

  getUserId(): string | null {
    if (!this.currentUserId) {
      this.currentUserId = localStorage.getItem("selected_user_id");
    }
    return this.currentUserId;
  }

  /**
   * JWT認証トークンをセットします（メモリ保持のみに移行し、localStorageには保存しません）。
   * 以降、すべてのリクエストヘッダーに 'Authorization: Bearer <token>' として自動的に付与されます。
   */
  setToken(token: string | null) {
    this.currentToken = token;
  }

  getToken(): string | null {
    return this.currentToken;
  }

  /**
   * 共通のHTTPリクエスト処理
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...restOptions } = options;

    // 1. クエリパラメータを含めたURLの構築
    const base = this.baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const url = new URL(endpoint, base);
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      });
    }

    // 2. ヘッダーの処理
    const requestHeaders = new Headers(headers);
    
    // ボディが FormData でない場合、デフォルトで application/json を指定
    if (!requestHeaders.has("Content-Type") && !(restOptions.body instanceof FormData)) {
      requestHeaders.set("Content-Type", "application/json");
    }

    // マルチテナント対応: ターゲットのワークスペースIDをヘッダーにセット
    const wId = this.getWorkspaceId();
    if (wId) {
      requestHeaders.set("X-Workspace-Id", wId);
    }

    const uId = this.getUserId();
    if (uId) {
      requestHeaders.set("X-User-Id", uId);
    }

    const token = this.getToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    const config: RequestInit = {
      ...restOptions,
      headers: requestHeaders,
      credentials: "include", // Cookie (HttpOnly) の送信を許可
    };

    try {
      const response = await fetch(url.toString(), config);

      // 401 Unauthorizedのとき、サイレントリフレッシュを試みる
      if (
        response.status === 401 &&
        endpoint !== "/api/auth/refresh" &&
        endpoint !== "/api/auth/login" &&
        endpoint !== "/api/auth/recovery"
      ) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const newToken = await this.refreshAccessToken();
            this.isRefreshing = false;
            this.onTokenRefreshed(newToken);
          } catch (refreshErr) {
            this.isRefreshing = false;
            this.setToken(null);
            // グローバルにログアウトを通知するイベントを発火
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("auth:logout"));
            }
            throw new ApiError("Session expired. Please log in again.", 401);
          }
        }

        // リフレッシュが完了するまで待機し、新しいトークンでリクエストを再試行する
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber((newToken) => {
            requestHeaders.set("Authorization", `Bearer ${newToken}`);
            this.request<T>(endpoint, { ...options, headers: requestHeaders })
              .then(resolve)
              .catch(reject);
          });
        });
      }
      
      // レスポンスの解析
      let responseData: any = null;
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // エラー時のハンドリング
      if (!response.ok) {
        throw new ApiError(
          responseData?.error || `API request failed with status ${response.status}`,
          response.status,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Network connection failed",
        0
      );
    }
  }

  // GET ショートカット
  get<T>(endpoint: string, params?: Record<string, string>, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", params, ...options });
  }

  // POST ショートカット
  post<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
      ...options,
    });
  }

  // PUT ショートカット
  put<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: "PUT",
      body: isFormData ? body : JSON.stringify(body),
      ...options,
    });
  }

  // DELETE ショートカット
  delete<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  }
}

// シングルトンインスタンスのエクスポート (Pages Functions のため、デフォルトは同一オリジンの相対パスになります)
export const apiClient = new ApiClient(
  (import.meta as any).env?.VITE_API_BASE_URL || ""
);
