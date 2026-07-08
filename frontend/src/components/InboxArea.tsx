import React from 'react';
import { Inbox, CheckCircle2, MessageSquare, UserPlus, Check, Clock, Eye, Archive, RotateCcw, Menu } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  senderId: string | null;
  senderName: string | null;
  type: 'mention' | 'dm' | 'assign' | 'task_done';
  title: string;
  content: string;
  linkUrl: string | null;
  isRead: number;
  isArchived: number;
  createdAt: string;
  workspaceName?: string | null;
}

interface InboxAreaProps {
  workspaceId: string | null;
  notifications: Notification[];
  loading: boolean;
  filter: 'unread' | 'all' | 'archived';
  onFilterChange: (filter: 'unread' | 'all' | 'archived') => void;
  onReadNotification: (id: string) => Promise<void>;
  onReadAllNotifications: () => Promise<void>;
  onArchiveNotification: (id: string, archive: boolean) => Promise<void>;
  onJumpToLink: (linkUrl: string, workspaceId: string) => void;
  onMenuClick?: () => void;
}

export const InboxArea: React.FC<InboxAreaProps> = ({
  workspaceId,
  notifications,
  loading,
  filter,
  onFilterChange,
  onReadNotification,
  onReadAllNotifications,
  onArchiveNotification,
  onJumpToLink,
  onMenuClick,
}) => {
  const { t } = useLanguage();
  // サーバー側でフィルター済みのデータを受け取るため、フロントでのフィルタリングは不要です
  const displayedNotifications = notifications;

  const handleNotificationClick = async (notif: Notification) => {
    if (notif.isRead === 0) {
      await onReadNotification(notif.id);
    }
    if (notif.linkUrl) {
      onJumpToLink(notif.linkUrl, notif.workspaceId);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return <MessageSquare size={16} style={{ color: 'var(--primary-color)' }} />;
      case 'dm':
        return <MessageSquare size={16} style={{ color: '#10b981' }} />;
      case 'assign':
        return <UserPlus size={16} style={{ color: '#f59e0b' }} />;
      case 'task_done':
        return <CheckCircle2 size={16} style={{ color: '#10b981' }} />;
      default:
        return <Inbox size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getTypeLabel = (type: string) => {
    const isEn = t('error') === 'Error';
    switch (type) {
      case 'mention':
        return isEn ? 'Mention' : 'メンション';
      case 'dm':
        return isEn ? 'Message' : 'メッセージ';
      case 'assign':
        return isEn ? 'Assign' : 'タスク担当';
      case 'task_done':
        return isEn ? 'Completed' : 'タスク完了';
      default:
        return isEn ? 'Notice' : '通知';
    }
  };

  // 時刻フォーマット
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(t('error') === 'Error' ? 'en-US' : 'ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minWidth: 0 }}>
      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {/* ヘッダー */}
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {onMenuClick && (
              <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                <Menu size={20} />
              </button>
            )}
            <h1 className="channel-info-title" style={{ margin: 0 }}>{t('sidebar.inbox')}</h1>
            <span className="channel-info-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('error') === 'Error' ? 'Aggregates important mentions, task assignments, and DMs for you.' : 'あなた宛ての重要なメンションやタスクのアサイン、DMを集約します。'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            {/* 一括既読 */}
            {notifications.some(n => n.isRead === 0) && (
              <button
                onClick={onReadAllNotifications}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <Check size={14} />
                <span className="channel-members-count-text">{t('error') === 'Error' ? 'Mark all as read' : 'すべて既読にする'}</span>
              </button>
            )}
          </div>
        </div>

      {/* フィルターバー */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)', padding: '0 24px', flexShrink: 0 }}>
        <button
          onClick={() => onFilterChange('unread')}
          style={{
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: filter === 'unread' ? '600' : '500',
            color: filter === 'unread' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: filter === 'unread' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          {t('error') === 'Error' ? 'Unread' : '未読'}
        </button>
        <button
          onClick={() => onFilterChange('all')}
          style={{
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: filter === 'all' ? '600' : '500',
            color: filter === 'all' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: filter === 'all' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          {t('error') === 'Error' ? 'All' : 'すべて'}
        </button>
        <button
          onClick={() => onFilterChange('archived')}
          style={{
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: filter === 'archived' ? '600' : '500',
            color: filter === 'archived' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: filter === 'archived' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          {t('error') === 'Error' ? 'Archived' : 'アーカイブ'}
        </button>
      </div>

      {loading && (
        <div style={{ padding: '8px 24px', background: 'rgba(100,108,255,0.05)', color: 'var(--primary-color)', fontSize: '12px', textAlign: 'center' }}>
          {t('loading')}
        </div>
      )}

      {/* 通知リストリスト */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displayedNotifications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-muted)', gap: '12px' }}>
            <Inbox size={48} strokeWidth={1} style={{ opacity: 0.5 }} />
            <p style={{ fontSize: '14px' }}>{t('error') === 'Error' ? 'No new notifications' : '新しい通知はありません'}</p>
          </div>
        ) : (
          displayedNotifications.map((notif) => {
            const isUnread = notif.isRead === 0;
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                style={{
                  background: isUnread ? 'rgba(var(--primary-color-rgb, 100, 108, 255), 0.04)' : 'var(--bg-secondary)',
                  border: isUnread ? '1px solid rgba(100, 108, 255, 0.25)' : '1px solid var(--border-light)',
                  borderLeft: isUnread ? '4px solid var(--primary-color)' : '4px solid transparent',
                  borderRadius: '6px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.borderColor = isUnread ? 'rgba(100, 108, 255, 0.4)' : 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = isUnread ? 'rgba(100, 108, 255, 0.25)' : 'var(--border-light)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 左側情報 */}
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '32px',
                    width: '32px',
                    flexShrink: 0
                  }}>
                    {getIcon(notif.type)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {notif.workspaceName && (
                        <span style={{ fontSize: '11px', background: 'var(--accent-primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {notif.workspaceName}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {getTypeLabel(notif.type)}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {notif.title}
                      </span>
                    </div>
                    
                    <p style={{
                      fontSize: '13px',
                      color: isUnread ? 'var(--text-primary)' : 'var(--text-muted)',
                      margin: '4px 0 0 0',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {notif.content}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Clock size={11} />
                      <span>{formatTime(notif.createdAt)}</span>
                      {notif.senderName && (
                        <span>{t('error') === 'Error' ? `・ Sender: ${notif.senderName}` : `・ 送信者: ${notif.senderName}`}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右側アクションアイコン */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {!isUnread && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginRight: '4px' }}>{t('error') === 'Error' ? 'Read' : '既読'}</span>
                  )}
                  
                  {isUnread && (
                    <button
                      title={t('error') === 'Error' ? 'Mark as read' : '既読にする'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReadNotification(notif.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100,108,255,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <Eye size={16} />
                    </button>
                  )}

                  {notif.isArchived === 1 ? (
                    <button
                      title={t('error') === 'Error' ? 'Unarchive' : 'アーカイブを解除する'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchiveNotification(notif.id, false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button
                      title={t('error') === 'Error' ? 'Archive' : 'アーカイブする'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchiveNotification(notif.id, true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      <Archive size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
};
