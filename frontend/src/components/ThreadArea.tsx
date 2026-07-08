import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../hooks/useChat';
import { X, Send, Smile, Paperclip } from 'lucide-react';

interface ThreadAreaProps {
  parentMessage: Message;
  replies: Message[];
  currentUserId: string;
  onSendReply: (content: string, parentId: string) => Promise<void>;
  onClose: () => void;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
}

export const ThreadArea: React.FC<ThreadAreaProps> = ({
  parentMessage,
  replies,
  currentUserId,
  onSendReply,
  onClose,
  onToggleReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const repliesEndRef = useRef<HTMLDivElement | null>(null);

  // 絵文字パレット表示管理
  const [showEmojiPaletteMsgId, setShowEmojiPaletteMsgId] = useState<string | null>(null);
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

  // 返信追加時に自動スクロール
  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText('');
    await onSendReply(textToSend, parentMessage.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFileAttachment = (fileUrl: string | null | undefined, fileName: string | null | undefined, fileSize: number | null | undefined) => {
    if (!fileUrl) return null;
    return (
      <div style={{ marginTop: '6px' }}>
        {isImageFile(fileName || '') ? (
          <div className="attachment-image-preview">
            <img 
              src={fileUrl.startsWith('http') ? fileUrl : `http://127.0.0.1:8787${fileUrl}`} 
              alt={fileName || 'Attachment'} 
              style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
              onClick={() => window.open(fileUrl.startsWith('http') ? fileUrl : `http://127.0.0.1:8787${fileUrl}`, '_blank')}
            />
          </div>
        ) : (
          <a 
            href={fileUrl.startsWith('http') ? fileUrl : `http://127.0.0.1:8787${fileUrl}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="attachment-file-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: '6px', textDecoration: 'none', color: 'var(--text-main)', fontSize: '12px' }}
          >
            <Paperclip size={14} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 500, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatFileSize(fileSize || 0)}</span>
            </div>
          </a>
        )}
      </div>
    );
  };

  const renderReactions = (msg: Message) => {
    if (!msg.reactions || msg.reactions.length === 0) return null;
    const isMessageSelf = msg.userId === currentUserId;
    return (
      <div className="reactions-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {Object.entries(
          msg.reactions.reduce((acc, r) => {
            if (!acc[r.emoji]) acc[r.emoji] = [];
            acc[r.emoji].push(r.userId);
            return acc;
          }, {} as Record<string, string[]>)
        ).map(([emoji, userIds]) => {
          const hasReacted = userIds.includes(currentUserId);
          return (
            <button
              key={emoji}
              className={`reaction-badge ${hasReacted ? 'active' : ''}`}
              onClick={() => !isMessageSelf && onToggleReaction(msg.id, emoji)}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px', 
                padding: '1px 6px', 
                background: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-panel)', 
                border: '1px solid', 
                borderColor: hasReacted ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-light)', 
                borderRadius: '10px', 
                fontSize: '10px', 
                cursor: isMessageSelf ? 'default' : 'pointer', 
                color: hasReacted ? 'var(--bg-active)' : 'var(--text-main)',
                opacity: isMessageSelf ? 0.8 : 1
              }}
              title={isMessageSelf ? `${userIds.length}人がリアクションしました（自分のメッセージにはリアクションできません）` : `${userIds.length}人がリアクションしました`}
              disabled={isMessageSelf}
            >
              <span>{emoji}</span>
              <span style={{ fontWeight: 600 }}>{userIds.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderReactionAction = (msgId: string, isMessageSelf: boolean) => {
    if (isMessageSelf) return null;
    return (
      <div style={{ display: 'flex', gap: '4px', position: 'relative', marginTop: '4px' }}>
        <button 
          className="message-actions-btn"
          onClick={() => setShowEmojiPaletteMsgId(showEmojiPaletteMsgId === msgId ? null : msgId)}
          title="リアクション"
          style={{ padding: '2px 6px', fontSize: '11px' }}
        >
          <Smile size={12} />
        </button>

        {showEmojiPaletteMsgId === msgId && (
          <div 
            className="emoji-palette" 
            style={{ 
              position: 'absolute', 
              bottom: '100%', 
              left: 0, 
              zIndex: 10, 
              display: 'flex', 
              gap: '2px', 
              padding: '4px', 
              background: 'var(--bg-panel)', 
              border: '1px solid var(--border-light)', 
              borderRadius: '16px', 
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' 
            }}
          >
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                onClick={async () => {
                  await onToggleReaction(msgId, emoji);
                  setShowEmojiPaletteMsgId(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', padding: '3px' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="thread-sidebar">
      {/* 1. スレッドヘッダー */}
      <div className="thread-header">
        <span className="thread-header-title">スレッド</span>
        <button className="thread-close-btn" onClick={onClose} title="閉じる">
          <X size={18} />
        </button>
      </div>

      {/* 2. 親メッセージ */}
      <div className="thread-parent-message">
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="message-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
            {parentMessage.user.displayName.substring(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div className="message-meta">
              <span className="message-sender" style={{ fontSize: '13px' }}>
                {parentMessage.user.displayName}
              </span>
              <span className="message-time">{formatTime(parentMessage.createdAt)}</span>
            </div>
            {parentMessage.content && (
              <div className="message-bubble" style={{ marginTop: '4px', padding: '8px 12px', fontSize: '13px', width: 'fit-content' }}>
                {parentMessage.content}
              </div>
            )}
            {renderFileAttachment(parentMessage.fileUrl, parentMessage.fileName, parentMessage.fileSize)}
            {renderReactions(parentMessage)}
            {renderReactionAction(parentMessage.id, parentMessage.userId === currentUserId)}
          </div>
        </div>
      </div>

      {/* 3. 返信一覧 */}
      <div className="thread-replies-viewport">
        {replies.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
            返信はまだありません。
          </p>
        ) : (
          replies.map((reply) => {
            const isSelf = reply.userId === currentUserId;
            return (
              <div key={reply.id} className="thread-reply-card" style={{ flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                <div className="message-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                  {reply.user.displayName.substring(0, 1).toUpperCase()}
                </div>
                <div className="message-content-wrapper" style={{ alignItems: isSelf ? 'flex-end' : 'flex-start', flex: 1 }}>
                  <div className="message-meta" style={{ flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                    <span className="message-sender" style={{ fontSize: '12px' }}>
                      {reply.user.displayName}
                    </span>
                    <span className="message-time">{formatTime(reply.createdAt)}</span>
                  </div>
                  {reply.content && (
                    <div className="message-bubble" style={{ 
                      marginTop: '4px', 
                      padding: '8px 12px', 
                      fontSize: '13px', 
                      background: isSelf ? 'var(--bg-active)' : 'var(--bg-panel)',
                      borderColor: isSelf ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-light)'
                    }}>
                      {reply.content}
                    </div>
                  )}
                  {renderFileAttachment(reply.fileUrl, reply.fileName, reply.fileSize)}
                  {renderReactions(reply)}
                  {renderReactionAction(reply.id, reply.userId === currentUserId)}
                  {reply.status === 'sending' && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>送信中...</span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={repliesEndRef} />
      </div>

      {/* 4. 返信入力フォーム */}
      <div className="chat-input-container" style={{ padding: '16px' }}>
        <form onSubmit={handleSend} className="chat-input-wrapper">
          <textarea
            className="chat-textarea"
            placeholder="返信を入力..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ minHeight: '36px' }}
          />
          <div className="chat-input-actions">
            <div className="input-action-buttons" />
            <button
              type="submit"
              className="send-btn"
              disabled={!inputText.trim()}
              title="返信を送信"
              style={{ width: '28px', height: '28px' }}
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
};
