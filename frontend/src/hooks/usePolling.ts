import { useEffect, useRef, useState } from 'react';

interface UsePollingOptions {
  /** 現在選択されているチャンネル of ID */
  channelId: string | null;
  /**
   * メッセージのフェッチ処理を行う非同期関数。
   * 新しく取得したメッセージの件数をPromiseで返す必要があります。
   */
  onFetch: () => Promise<number>;
  /** 最小ポーリング間隔 (ミリ秒)。デフォルトは 5000ms (5秒) */
  minInterval?: number;
  /** 最大ポーリング間隔 (ミリ秒)。デフォルトは 30000ms (30秒) */
  maxInterval?: number;
}

/**
 * 画面のアクティブ状態（document.visibilityState）に応じて、
 * `setInterval` と `clearInterval` を用いてポーリングの開始・停止・動的制御を行うフック。
 */
export function usePolling({
  channelId,
  onFetch,
  minInterval = 5000,
  maxInterval = 30000,
}: UsePollingOptions) {
  // 現在のポーリング間隔
  const [intervalTime, setIntervalTime] = useState<number>(minInterval);
  // ブラウザのタブがアクティブかどうか
  const [isActive, setIsActive] = useState<boolean>(document.visibilityState === 'visible');

  // 連続で新着メッセージが0件だった回数
  const consecutiveEmptyCount = useRef<number>(0);
  // setIntervalのタイマーID保持用
  const intervalIdRef = useRef<any>(null);
  // 最新のonFetchを常に参照するためのref
  const onFetchRef = useRef(onFetch);

  // onFetchの参照を常に更新
  useEffect(() => {
    onFetchRef.current = onFetch;
  }, [onFetch]);

  // 1. ブラウザタブの表示状態 (visibilityState) を監視して、非アクティブ時にポーリングを停止
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsActive(visible);

      if (visible) {
        // アクティブに戻ったらカウンタをリセットし即座に最小間隔に戻す
        consecutiveEmptyCount.current = 0;
        setIntervalTime(minInterval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    setIsActive(document.visibilityState === 'visible');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [minInterval]);

  // 2. チャンネル変更時のリセットと即時取得
  useEffect(() => {
    if (!channelId) return;

    consecutiveEmptyCount.current = 0;
    setIntervalTime(minInterval);

    // 画面がアクティブなら即座にメッセージを取得する
    if (document.visibilityState === 'visible') {
      onFetchRef.current().catch((err) => {
        console.error('Initial fetch failed on channel change:', err);
      });
    }
  }, [channelId, minInterval]);

  // 3. setInterval と clearInterval によるポーリング制御
  useEffect(() => {
    // 既存のタイマーをクリア (clearInterval)
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // チャンネル未選択、またはタブが非アクティブな場合はポーリングを起動しない
    if (!channelId || !isActive) {
      return;
    }

    const runPoll = async () => {
      try {
        const newCount = await onFetchRef.current();

        if (newCount > 0) {
          consecutiveEmptyCount.current = 0;
          if (intervalTime !== minInterval) {
            setIntervalTime(minInterval);
          }
        } else {
          consecutiveEmptyCount.current += 1;
          const count = consecutiveEmptyCount.current;
          let nextInterval = minInterval;

          if (count > 10) {
            nextInterval = maxInterval;
          } else if (count > 5) {
            nextInterval = Math.min(15000, maxInterval);
          } else if (count > 2) {
            nextInterval = Math.min(10000, maxInterval);
          }

          if (nextInterval !== intervalTime) {
            setIntervalTime(nextInterval);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (intervalTime !== maxInterval) {
          setIntervalTime(maxInterval);
        }
      }
    };

    // 指定された intervalTime で定期実行を設定
    intervalIdRef.current = setInterval(runPoll, intervalTime);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [channelId, isActive, intervalTime, minInterval, maxInterval]);

  return {
    intervalTime,
    isActive,
    consecutiveEmptyCount: consecutiveEmptyCount.current,
  };
}
