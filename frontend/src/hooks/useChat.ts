import { useState, useCallback, useEffect } from 'react';

export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Message {
  /** 確定メッセージはUUID、楽観的UI用は 'temp_...' から始まる一時的なID */
  id: string;
  channelId: string;
  userId: string;
  parentId?: string | null;
  parentMessage?: {
    content: string;
    userDisplayName: string;
  } | null;
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  /** 送信状態: 'sending' (送信中), 'sent' (送信完了), 'failed' (送信失敗) */
  status: 'sending' | 'sent' | 'failed';
  createdAt: string; // ISO 8601 形式のタイムスタンプ
  user: User; // メッセージ送信者の簡易プロフィール情報
  replyCount?: number;
  lastReplyAt?: string | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    userId: string;
    displayName: string;
  }>;
}

interface UseChatOptions {
  /** 現在表示しているチャンネルのID */
  channelId: string;
  /** 現在ログインしているユーザーの情報 */
  currentUser: User;
  /**
   * Cloudflare Workers の API を呼び出してメッセージを保存する実処理。
   */
  apiSendMessage: (params: {
    channelId: string;
    content: string;
    parentId?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
  }) => Promise<{ id: string; createdAt: string }>;
}

/**
 * 楽観的UI（Optimistic UI）を用いてメッセージの送信・状態管理、
 * 送信失敗時の再送、ポーリングデータとの動的なマージを処理するReactカスタムフック。
 */
export function useChat({ channelId, currentUser, apiSendMessage }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);

  // チャンネル切り替え時にローカルのメッセージをリセットする
  useEffect(() => {
    setMessages([]);
  }, [channelId]);

  /**
   * ポーリングや履歴取得によってサーバーから取得したメッセージ群を、
   * 楽観的UIの状態を壊さずに安全にローカルステートに統合します。
   */
  const setFetchedMessages = useCallback((fetched: Message[]) => {
    setMessages((prev) => {
      // 既存のメッセージのうち、今回取得したメッセージ以外のものを抽出
      const fetchedIds = new Set(fetched.map((m) => m.id));
      const unchanged = prev.filter((m) => !fetchedIds.has(m.id));

      // 既存のメッセージ（重複除外後）と新規取得メッセージをマージ
      const combined = [...unchanged, ...fetched];

      // メッセージを作成日時（createdAt）の古い順（昇順）にソート
      return combined.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  /**
   * Workers APIを叩いてメッセージを送信する内部ヘルパー関数
   */
  const executeSend = useCallback(
    async (
      tempId: string, 
      content: string, 
      parentId?: string | null,
      fileUrl?: string | null,
      fileName?: string | null,
      fileSize?: number | null
    ) => {
      try {
        const response = await apiSendMessage({
          channelId,
          content,
          parentId,
          fileUrl,
          fileName,
          fileSize,
        });

        // 送信成功: 楽観的に追加した一時的なメッセージを、サーバーの確定情報で更新
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === tempId) {
              return {
                ...msg,
                id: response.id, // サーバーで生成された一意のID
                createdAt: response.createdAt,
                status: 'sent', // ステータスを送信完了にする
              };
            }
            return msg;
          })
        );
      } catch (error) {
        console.error('Failed to send message to Workers API:', error);

        // 送信失敗: ステータスを送信失敗にし、ユーザーに再送や削除を促す
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === tempId) {
              return {
                ...msg,
                status: 'failed',
              };
            }
            return msg;
          })
        );
      }
    },
    [channelId, apiSendMessage]
  );

  /**
   * メッセージ送信（楽観的UIの適用）
   */
  const sendMessage = useCallback(
    async (
      content: string, 
      parentId?: string | null,
      fileUrl?: string | null,
      fileName?: string | null,
      fileSize?: number | null
    ) => {
      if (!content.trim() && !fileUrl) return;

      // 一時的なIDの生成 (クライアント側で一意なID)
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const optimisticMessage: Message = {
        id: tempId,
        channelId,
        userId: currentUser.id,
        parentId: parentId || null,
        content,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        status: 'sending', // 送信中ステータス
        createdAt: new Date().toISOString(),
        user: currentUser,
        reactions: [],
      };

      // 1. サーバーの応答を待たずに、即座にメッセージ一覧の末尾へ追加 (楽観的UI)
      setMessages((prev) => [...prev, optimisticMessage]);

      // 2. バックグラウンドで実際のAPIリクエストを実行
      await executeSend(tempId, content, parentId, fileUrl, fileName, fileSize);
    },
    [channelId, currentUser, executeSend]
  );

  /**
   * 送信に失敗したメッセージの再送信処理
   */
  const retryMessage = useCallback(
    async (messageId: string) => {
      const targetMsg = messages.find((m) => m.id === messageId);
      if (!targetMsg || targetMsg.status !== 'failed') return;

      // ローカルステート上のステータスを一時的に 'sending' (送信中) に戻す
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, status: 'sending' };
          }
          return msg;
        })
      );

      // 再度送信処理を走らせる
      await executeSend(
        messageId, 
        targetMsg.content, 
        targetMsg.parentId,
        targetMsg.fileUrl,
        targetMsg.fileName,
        targetMsg.fileSize
      );
    },
    [messages, executeSend]
  );

  /**
   * 送信に失敗したメッセージをローカル履歴から削除する処理
   */
  const deleteFailedMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  /**
   * ローカルのリアクション状態を楽観的にトグルする
   */
  const toggleLocalReaction = useCallback((messageId: string, emoji: string, user: User) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const currentReactions = msg.reactions || [];
        const existingIdx = currentReactions.findIndex(
          (r) => r.userId === user.id && r.emoji === emoji
        );

        let newReactions = [...currentReactions];
        if (existingIdx > -1) {
          // 既に選択済みなら削除
          newReactions.splice(existingIdx, 1);
        } else {
          // 未選択なら追加
          newReactions.push({
            id: `temp_reaction_${Date.now()}`,
            emoji,
            userId: user.id,
            displayName: user.displayName,
          });
        }

        return {
          ...msg,
          reactions: newReactions,
        };
      })
    );
  }, []);

  return {
    messages,
    sendMessage,
    retryMessage,
    deleteFailedMessage,
    setFetchedMessages,
    toggleLocalReaction,
  };
}
