import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../hooks/useChat';
import { Send, Smile, Paperclip, AlertCircle, RefreshCw, Trash2, HelpCircle, X, Loader, MessageSquare, CheckSquare, BookOpen, Menu, Image } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { CreateItemModal } from './CreateItemModal';
import { DocumentPanel } from './DocumentPanel';
import { ItemsArea } from './ItemsArea';
import { MediaLibraryArea } from './MediaLibraryArea';
import { useLanguage } from '../utils/i18n';

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  description?: string;
  type?: string;
  groupId?: string | null;
  updatedAt?: string | null;
}

interface ChatAreaProps {
  channelName: string;
  channelDescription?: string;
  messages: Message[];
  currentUserId: string;
  channelMembers?: any[];
  workspaceMembers?: any[];
  workspaceId: string | null;
  activeChannelId: string | null;
  channels: Channel[];
  onSendMessage: (content: string, fileUrl?: string | null, fileName?: string | null, fileSize?: number | null) => Promise<void>;
  onRetryMessage: (messageId: string) => void;
  onDeleteFailedMessage: (messageId: string) => void;
  onSetReplyTarget: (message: Message | null) => void;
  replyTargetMessage: Message | null;
  onCancelReply: () => void;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  pollingInfo: {
    intervalTime: number;
    isActive: boolean;
    consecutiveEmptyCount: number;
  };
  onMenuClick?: () => void;
  currentUserRole?: 'owner' | 'group_admin' | 'member' | 'guest';
  workspace?: { id: string; name: string; custom_statuses?: string } | null;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channelName,
  channelDescription,
  messages,
  currentUserId,
  channelMembers = [],
  workspaceMembers = [],
  workspaceId,
  activeChannelId,
  channels,
  onSendMessage,
  onRetryMessage,
  onDeleteFailedMessage,
  onSetReplyTarget,
  replyTargetMessage,
  onCancelReply,
  onToggleReaction,
  pollingInfo,
  onMenuClick,
  currentUserRole = 'member',
  workspace = null,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // チャンネルドキュメント用ステートと処理
  const [showDoc, setShowDoc] = useState(false);
  const [docText, setDocText] = useState('');
  const [isDocFullScreen, setIsDocFullScreen] = useState(false);

  // タスク・メディアパネルトグルステート
  const [showTasks, setShowTasks] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [isTasksFullScreen, setIsTasksFullScreen] = useState(false);
  const [isMediaFullScreen, setIsMediaFullScreen] = useState(false);

  const fetchDoc = async () => {
    if (!activeChannelId) return;
    try {
      const res = await apiClient.get<{ success: boolean; document: string }>(
        `/api/channels/${activeChannelId}/document`
      );
      if (res.success) {
        setDocText(res.document || '');
      }
    } catch (err) {
      console.error('Failed to fetch channel document:', err);
    }
  };

  useEffect(() => {
    if (showDoc && activeChannelId) {
      fetchDoc();
    }
  }, [activeChannelId, showDoc]);

  const handleToggleDoc = () => {
    if (!showDoc) {
      fetchDoc();
    }
    setShowDoc(!showDoc);
    setShowTasks(false);
    setShowMedia(false);
    setIsDocFullScreen(false);
  };

  const handleToggleTasks = () => {
    setShowTasks(!showTasks);
    setShowMedia(false);
    setShowDoc(false);
    setIsTasksFullScreen(false);
  };

  const handleToggleMedia = () => {
    setShowMedia(!showMedia);
    setShowTasks(false);
    setShowDoc(false);
    setIsMediaFullScreen(false);
  };

  // チャンネル切り替え時にすべてのトグルをリセット
  useEffect(() => {
    setShowTasks(false);
    setShowMedia(false);
    setShowDoc(false);
    setIsTasksFullScreen(false);
    setIsMediaFullScreen(false);
  }, [activeChannelId]);

  const saveChannelDoc = async (text: string) => {
    if (!activeChannelId) return;
    const res = await apiClient.put<{ success: boolean }>(
      `/api/channels/${activeChannelId}/document`,
      { document: text }
    );
    if (res.success) {
      setDocText(text);
    } else {
      throw new Error(isEn ? 'Failed to save' : '保存できませんでした');
    }
  };

  // アイテム連携用ステート
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemInitialData, setItemInitialData] = useState<any>(null);
  const [itemInitialType, setItemInitialType] = useState<'task' | 'event' | null>(null);

  const handleAddItemFromMessage = (msg: Message, type: 'task' | 'event') => {
    const currentChan = channels.find(c => c.id === activeChannelId);
    const isChanPrivate = currentChan ? (currentChan.isPrivate || currentChan.type === 'dm') : true;

    if (type === 'task') {
      setItemInitialData({
        title: msg.content.substring(0, 30),
        description: `【チャットメッセージより登録】\n送信者: ${msg.user.displayName}\n本文:\n${msg.content}`,
        assigneeId: null,
        status: 'todo',
        startAt: null,
        endAt: null,
        isAllDay: false,
        isPrivate: isChanPrivate,
        channelId: activeChannelId,
      });
    } else {
      const start = new Date();
      start.setMinutes(0);
      start.setSeconds(0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      setItemInitialData({
        title: msg.content.substring(0, 30),
        description: `【チャットメッセージより登録】\n送信者: ${msg.user.displayName}\n本文:\n${msg.content}`,
        assigneeId: null,
        status: 'todo',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        isAllDay: false,
        isPrivate: isChanPrivate,
        channelId: activeChannelId,
      });
    }
    setItemInitialType(type);
    setIsItemModalOpen(true);
  };

  const handleSaveItemFromChat = async (itemData: any) => {
    if (!workspaceId) return;
    await apiClient.post(`/api/workspaces/${workspaceId}/items`, itemData);
    alert(isEn ? 'Item registered successfully' : 'アイテムを登録しました');
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('reply-highlight');
      setTimeout(() => {
        element.classList.remove('reply-highlight');
      }, 2000);
    }
  };

  // ファイル添付関連のステート
  const [attachedFile, setAttachedFile] = useState<{
    url: string;
    name: string;
    size: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // リアクション絵文字パレットの表示管理（メッセージIDを保持）
  const [showEmojiPaletteMsgId, setShowEmojiPaletteMsgId] = useState<string | null>(null);

  // メンバー一覧ポップオーバーの表示管理
  const [showMembersPopover, setShowMembersPopover] = useState(false);

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

  // メッセージ追加時に自動最下部スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // チャンネル切り替え時にメンバーポップオーバーを閉じる
  useEffect(() => {
    setShowMembersPopover(false);
  }, [channelName]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;
    const textToSend = inputText;
    const fileToSend = attachedFile;

    setInputText(''); // 送信後入力欄を即クリア
    setAttachedFile(null); // 添付ファイルもクリア

    await onSendMessage(
      textToSend,
      fileToSend?.url || null,
      fileToSend?.name || null,
      fileToSend?.size || null
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // ファイル添付ボタンクリック時の処理
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // ファイル選択後のアップロード処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post<{
        success: boolean;
        fileUrl: string;
        objectKey: string;
      }>('/api/files/upload', formData);

      if (response.success && response.fileUrl) {
        setAttachedFile({
          url: response.fileUrl,
          name: file.name,
          size: file.size,
        });
      }
    } catch (err: any) {
      alert((isEn ? 'Failed to upload file: ' : 'ファイルのアップロードに失敗しました: ') + (err.message || err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // タイムスタンプのフォーマット
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

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minWidth: 0 }}>
      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {/* 1. ヘッダー */}
        <div className="chat-header">
          {onMenuClick && (
            <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
              <Menu size={20} />
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <h1 className="channel-info-title">#{channelName}</h1>
            {channelDescription && <p className="channel-info-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channelDescription}</p>}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* 参加中メンバーの顔ぶれ */}
            {channelMembers && channelMembers.length > 0 && (
              <div 
                className="channel-members-trigger"
                onClick={() => setShowMembersPopover(!showMembersPopover)}
                title={isEn ? 'Show members' : 'メンバー一覧を表示'}
              >
                <div className="avatar-group">
                  {channelMembers.slice(0, 3).map((member, idx) => (
                    <div 
                      key={member.userId} 
                      className="avatar-group-item"
                      style={{ zIndex: 3 - idx }}
                    >
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.displayName} />
                      ) : (
                        member.displayName.substring(0, 1).toUpperCase()
                      )}
                    </div>
                  ))}
                  {channelMembers.length > 3 && (
                    <div className="avatar-group-item-more">
                      +{channelMembers.length - 3}
                    </div>
                  )}
                </div>
                <span className="channel-members-count-text">
                  {isEn ? (channelMembers.length === 1 ? '1 member' : `${channelMembers.length} members`) : `${channelMembers.length} 人のメンバー`}
                </span>
              </div>
            )}

            {/* ポーリング監視モニター */}
            <div className={`polling-badge ${pollingInfo.isActive ? 'active' : ''}`}>
              <span>
                {pollingInfo.isActive 
                  ? `Syncing (${pollingInfo.intervalTime / 1000}s)` 
                  : 'Paused'}
              </span>
              {pollingInfo.isActive && pollingInfo.consecutiveEmptyCount > 0 && (
                <span style={{ opacity: 0.7, fontSize: '10px' }}>
                  (No news x{pollingInfo.consecutiveEmptyCount})
                </span>
              )}
            </div>
            
            {/* タスク一覧トグル */}
            <button
              type="button"
              className={`input-icon-btn ${showTasks ? 'active' : ''}`}
              onClick={handleToggleTasks}
              title={isEn ? 'Channel Tasks' : 'チャネルタスク一覧'}
              style={{
                background: showTasks ? 'var(--bg-active)' : 'transparent',
                color: showTasks ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckSquare size={18} />
            </button>

            {/* メディア一覧トグル */}
            <button
              type="button"
              className={`input-icon-btn ${showMedia ? 'active' : ''}`}
              onClick={handleToggleMedia}
              title={isEn ? 'Channel Media' : 'チャネルメディア一覧'}
              style={{
                background: showMedia ? 'var(--bg-active)' : 'transparent',
                color: showMedia ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Image size={18} />
            </button>

            {/* ドキュメントトグル */}
            <button
              type="button"
              className={`input-icon-btn ${showDoc ? 'active' : ''}`}
              onClick={handleToggleDoc}
              title={isEn ? 'Channel Document' : 'チャンネルドキュメント'}
              style={{
                background: showDoc ? 'var(--bg-active)' : 'transparent',
                color: showDoc ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={18} />
            </button>
          </div>
        </div>

        {/* メンバー一覧ポップオーバー */}
        {showMembersPopover && channelMembers && channelMembers.length > 0 && (
          <div className="members-popover">
            <div className="members-popover-header">
              <span className="members-popover-title">{isEn ? `Members (${channelMembers.length})` : `メンバー (${channelMembers.length})`}</span>
              <button 
                className="members-popover-close"
                onClick={() => setShowMembersPopover(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="members-popover-list">
              {channelMembers.map((member) => (
                <div key={member.userId} className="members-popover-item">
                  <div className="member-popover-avatar">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.displayName} />
                    ) : (
                      member.displayName.substring(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="member-popover-info">
                    <span className="member-popover-name">{member.displayName}</span>
                    <span className="member-popover-email">{member.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* チャンネルドキュメント */}
        {showDoc && (
          <div 
            style={
              isDocFullScreen 
                ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', background: 'var(--bg-main)', height: '100%', width: '100%' }
                : { height: '350px', borderBottom: '1px solid var(--border-light)', display: 'flex', background: 'var(--bg-main)', flexShrink: 0 }
            }
          >
            <DocumentPanel
              title={isEn ? `${channelName}'s Document` : `${channelName} のドキュメント`}
              initialValue={docText}
              onSave={saveChannelDoc}
              onClose={() => {
                setShowDoc(false);
                setIsDocFullScreen(false);
              }}
              onToggleFullScreen={() => setIsDocFullScreen(!isDocFullScreen)}
              isFullScreen={isDocFullScreen}
              type="chat"
            />
          </div>
        )}

        {/* チャンネルタスク */}
        {showTasks && (
          <div 
            style={
              isTasksFullScreen 
                ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', background: 'var(--bg-main)', height: '100%', width: '100%' }
                : { height: '350px', borderBottom: '1px solid var(--border-light)', display: 'flex', background: 'var(--bg-main)', flexShrink: 0 }
            }
          >
            <ItemsArea
              workspaceId={workspaceId}
              workspace={workspace}
              activeChannelId={activeChannelId}
              channels={channels}
              workspaceMembers={workspaceMembers || []}
              currentUserId={currentUserId}
              isChatMode={true}
              onClose={() => {
                setShowTasks(false);
                setIsTasksFullScreen(false);
              }}
              onToggleFullScreen={() => setIsTasksFullScreen(!isTasksFullScreen)}
              isFullScreen={isTasksFullScreen}
            />
          </div>
        )}

        {/* チャンネルメディア */}
        {showMedia && (
          <div 
            style={
              isMediaFullScreen 
                ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', background: 'var(--bg-main)', height: '100%', width: '100%' }
                : { height: '350px', borderBottom: '1px solid var(--border-light)', display: 'flex', background: 'var(--bg-main)', flexShrink: 0 }
            }
          >
            <MediaLibraryArea
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              channels={channels}
              isChatMode={true}
              onClose={() => {
                setShowMedia(false);
                setIsMediaFullScreen(false);
              }}
              onToggleFullScreen={() => setIsMediaFullScreen(!isMediaFullScreen)}
              isFullScreen={isMediaFullScreen}
              activeChannelId={activeChannelId}
            />
          </div>
        )}

        {/* メインチャット表示エリア（ドキュメント/タスク/メディアが全画面表示のときは非表示に） */}
        {!(showDoc && isDocFullScreen) && !(showTasks && isTasksFullScreen) && !(showMedia && isMediaFullScreen) && (
          <>
            {/* 2. メッセージ表示エリア */}
            <div className="messages-viewport">
              {messages.length === 0 ? (
                <div className="no-message-selected">
                  <HelpCircle size={48} strokeWidth={1} />
                  <p>{isEn ? 'No messages yet. Start the conversation!' : 'まだメッセージはありません。会話を始めましょう！'}</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.userId === currentUserId;
                  return (
                    <div key={msg.id} id={`message-${msg.id}`} className={`message-card ${isSelf ? 'self' : ''}`}>
                      <div className="message-avatar">
                        {msg.user.displayName.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="message-content-wrapper">
                        <div className="message-meta">
                          <span className="message-sender">{msg.user.displayName}</span>
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                        </div>

                        {/* 引用返信（リプライ）の表示 */}
                        {msg.parentMessage && (
                          <div 
                            className="reply-quote-preview" 
                            onClick={() => scrollToMessage(msg.parentId!)}
                            title={isEn ? 'Click to jump to the quoted message' : 'クリックして引用元メッセージに移動'}
                          >
                            <span className="reply-quote-sender">@{msg.parentMessage.userDisplayName}</span>
                            <span className="reply-quote-content">{msg.parentMessage.content}</span>
                          </div>
                        )}
                        
                        {/* メッセージ本文の吹き出し */}
                        {msg.content && (
                          <div className={`message-bubble ${msg.status === 'sending' ? 'pending' : ''}`}>
                            {msg.content}
                          </div>
                        )}

                        {/* 添付ファイルの表示 */}
                        {msg.fileUrl && (
                          <div className="message-attachment" style={{ marginTop: '6px' }}>
                            {isImageFile(msg.fileName || '') ? (
                              <div className="attachment-image-preview">
                                <img 
                                  src={msg.fileUrl.startsWith('http') ? msg.fileUrl : `http://127.0.0.1:8787${msg.fileUrl}`} 
                                  alt={msg.fileName || 'Attachment'} 
                                  style={{ maxWidth: '300px', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                                  onClick={() => window.open(msg.fileUrl!.startsWith('http') ? msg.fileUrl! : `http://127.0.0.1:8787${msg.fileUrl}`, '_blank')}
                                />
                              </div>
                            ) : (
                              <a 
                                href={msg.fileUrl.startsWith('http') ? msg.fileUrl : `http://127.0.0.1:8787${msg.fileUrl}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="attachment-file-link"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: '6px', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '13px' }}
                              >
                                <Paperclip size={16} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 500 }}>{msg.fileName}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatFileSize(msg.fileSize || 0)}</span>
                                </div>
                              </a>
                            )}
                          </div>
                        )}

                        {/* ステータスインジケーター（楽観的UI） */}
                        {msg.status === 'sending' && (
                          <div className="status-indicator pending">
                            <span>{isEn ? 'Sending...' : '送信中...'}</span>
                          </div>
                        )}

                        {msg.status === 'failed' && (
                          <div className="status-indicator failed">
                            <AlertCircle size={12} />
                            <span>{isEn ? 'Failed to send' : '送信に失敗しました'}</span>
                            <button 
                              className="retry-action-btn"
                              onClick={() => onRetryMessage(msg.id)}
                            >
                              {isEn ? 'Retry' : '再試行'}
                            </button>
                            <button 
                              className="delete-action-btn"
                              onClick={() => onDeleteFailedMessage(msg.id)}
                            >
                              {isEn ? 'Delete' : '削除'}
                            </button>
                          </div>
                        )}

                        {/* リアクション一覧のバッジ表示 */}
                        {msg.reactions && msg.reactions.length > 0 && (
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
                                  onClick={() => !isSelf && onToggleReaction(msg.id, emoji)}
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px', 
                                    padding: '2px 8px', 
                                    background: hasReacted ? 'rgba(14, 165, 233, 0.15)' : 'var(--bg-panel)', 
                                    border: '1px solid', 
                                    borderColor: hasReacted ? 'rgba(14, 165, 233, 0.4)' : 'var(--border-light)', 
                                    borderRadius: '12px', 
                                    fontSize: '11px', 
                                    cursor: isSelf ? 'default' : 'pointer', 
                                    color: hasReacted ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    transition: 'all 0.1s ease',
                                    opacity: isSelf ? 0.8 : 1
                                  }}
                                  title={isSelf 
                                    ? (isEn ? `${userIds.length} user(s) reacted (You cannot react to your own message)` : `${userIds.length}人がリアクションしました（自分のメッセージにはリアクションできません）`) 
                                    : (isEn ? `${userIds.length} user(s) reacted` : `${userIds.length}人がリアクションしました`)}
                                  disabled={isSelf}
                                >
                                  <span>{emoji}</span>
                                  <span style={{ fontWeight: 600 }}>{userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* メッセージアクション */}
                        {msg.status === 'sent' && (
                          <div className="message-actions" style={{ display: 'flex', gap: '6px', position: 'relative' }}>
                            <button 
                              className="message-actions-btn"
                              onClick={() => onSetReplyTarget(msg)}
                            >
                              {isEn ? 'Reply' : '返信する'}
                            </button>
                            <button 
                              className="message-actions-btn"
                              onClick={() => handleAddItemFromMessage(msg, 'task')}
                              title={isEn ? 'Register this message to task/schedule' : 'このメッセージをタスク・予定に登録'}
                            >
                              {isEn ? 'Add Task/Event' : 'タスク・予定追加'}
                            </button>
                            {!isSelf && (
                              <button 
                                className="message-actions-btn"
                                onClick={() => setShowEmojiPaletteMsgId(showEmojiPaletteMsgId === msg.id ? null : msg.id)}
                                title={isEn ? 'Reaction' : 'リアクション'}
                              >
                                <Smile size={14} />
                              </button>
                            )}

                            {showEmojiPaletteMsgId === msg.id && (
                              <div 
                                className="emoji-palette" 
                                style={{ 
                                  position: 'absolute', 
                                  bottom: '100%', 
                                  left: 0, 
                                  zIndex: 10, 
                                  display: 'flex', 
                                  gap: '4px', 
                                  padding: '6px', 
                                  background: 'var(--bg-panel)', 
                                  border: '1px solid var(--border-light)', 
                                  borderRadius: '20px', 
                                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)' 
                                }}
                              >
                                {commonEmojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="emoji-btn"
                                    onClick={async () => {
                                      await onToggleReaction(msg.id, emoji);
                                      setShowEmojiPaletteMsgId(null);
                                    }}
                                    style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px', transition: 'transform 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 添付ファイルのプレビュー（送信前） */}
            {uploading && (
              <div style={{ padding: '0 16px 8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Loader className="animate-spin" size={14} />
                <span>{isEn ? 'Uploading file...' : 'ファイルをアップロード中...'}</span>
              </div>
            )}

            {attachedFile && (
              <div style={{ margin: '0 16px 8px 16px', padding: '8px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <Paperclip size={16} />
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{attachedFile.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({formatFileSize(attachedFile.size)})</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setAttachedFile(null)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* 3. 送信フォーム */}
            <div className="chat-input-container">
              {/* 返信先のプレビュー表示 */}
              {replyTargetMessage && (
                <div className="chat-input-reply-preview">
                  <div className="reply-preview-info">
                    <span className="reply-preview-label">{isEn ? `Replying to @${replyTargetMessage.user.displayName}` : `@${replyTargetMessage.user.displayName} への返信`}</span>
                    <span className="reply-preview-text">{replyTargetMessage.content}</span>
                  </div>
                  <button 
                    type="button" 
                    className="reply-preview-cancel-btn"
                    onClick={onCancelReply} 
                    title={isEn ? 'Cancel reply' : '返信をキャンセル'}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} className={`chat-input-wrapper ${replyTargetMessage ? 'has-reply-preview' : ''}`}>
                <textarea
                  className="chat-textarea"
                  placeholder={isEn ? `Message #${channelName}` : `#${channelName} へのメッセージ`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="chat-input-actions">
                  <div className="input-action-buttons">
                    <button 
                      type="button" 
                      className="input-icon-btn" 
                      title={isEn ? 'Attach file' : 'ファイルを添付'}
                      onClick={triggerFileSelect}
                    >
                      <Paperclip size={18} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={!inputText.trim()}
                    title={isEn ? 'Send' : '送信'}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* チャットからの連携用モーダル */}
        <CreateItemModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false);
            setItemInitialData(null);
            setItemInitialType(null);
          }}
          channels={channels}
          workspaceMembers={workspaceMembers || []}
          workspaceStatuses={['todo', 'in_progress', 'done']}
          activeChannelId={activeChannelId}
          initialItem={itemInitialData}
          initialType={itemInitialType}
          onSave={handleSaveItemFromChat}
        />
      </div>
    </div>
  );
};
