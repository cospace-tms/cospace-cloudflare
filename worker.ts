import { onRequest } from "./functions/api/[[route]]";
import { Env } from "./functions/api/[[route]]";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Pages Function 用のコンテキストオブジェクトをエミュレートします
    const context = {
      request,
      env,
      ctx,
      next: async () => new Response("Not Found", { status: 404 }),
      params: {},
      data: {},
    };

    // 既存の Pages Function エントリポイントを呼び出します
    return onRequest(context as any);
  }
};
