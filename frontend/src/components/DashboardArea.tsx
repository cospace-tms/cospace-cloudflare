import React from 'react';
import { Calendar, CheckSquare, Clock, File, Inbox, MessageSquare, PlusCircle, Menu, Globe } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

export interface DashboardTask {
  id: string;
  workspaceId: string;
  workspaceName?: string | null;
  creatorId: string;
  creatorName?: string;
  title: string;
  description?: string;
  status: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  startAt?: string | null;
  endAt?: string | null;
  isAllDay: number;
}

export interface DashboardActivity {
  type: 'channel' | 'task' | 'file';
  id: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  content: string;
  createdAt: string;
  userName?: string | null;
}

export interface DashboardWorkspace {
  id: string;
  name: string;
  unreadCount?: number;
}

interface DashboardAreaProps {
  currentUserId: string;
  workspaces: DashboardWorkspace[];
  tasks: DashboardTask[];
  activities: DashboardActivity[];
  loading: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onJumpToLink: (linkUrl: string, workspaceId: string) => void;
  onMenuClick?: () => void;
}

export const DashboardArea: React.FC<DashboardAreaProps> = ({
  currentUserId,
  workspaces,
  tasks,
  activities,
  loading,
  onSelectWorkspace,
  onJumpToLink,
  onMenuClick,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';



  // 未読件数の多い順にソート
  const sortedWorkspaces = [...workspaces].sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0));

  // 自分の担当、または未完了のタスク
  const myTasks = tasks.filter(t => t.status !== 'done');

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return isEn ? 'To Do' : '未着手';
      case 'in_progress': return isEn ? 'In Progress' : '進行中';
      case 'done': return isEn ? 'Done' : '完了';
      default: return status;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'channel': return <MessageSquare size={16} style={{ color: 'var(--primary-color)' }} />;
      case 'task': return <CheckSquare size={16} style={{ color: '#f59e0b' }} />;
      case 'file': return <File size={16} style={{ color: '#10b981' }} />;
      default: return <PlusCircle size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getActivityActionLabel = (type: string, userName: string | null) => {
    const name = userName || (isEn ? 'Someone' : '誰か');
    switch (type) {
      case 'channel': return isEn ? `${name} created a new channel` : `${name} さんが新しいチャンネルを作成`;
      case 'task': return isEn ? `${name} created a new task` : `${name} さんが新しいタスクを作成`;
      case 'file': return isEn ? `${name} uploaded a file` : `${name} さんがファイルをアップロード`;
      default: return isEn ? 'New event' : '新しいイベント';
    }
  };

  const handleActivityClick = (act: DashboardActivity) => {
    let linkUrl = '';
    if (act.type === 'channel') {
      linkUrl = `/channels/${act.id}`;
    } else if (act.type === 'task') {
      linkUrl = `/items?item=${act.id}`;
    } else if (act.type === 'file') {
      linkUrl = `/media`;
    }
    if (linkUrl) {
      onJumpToLink(linkUrl, act.workspaceId);
    }
  };

  const handleTaskClick = (task: DashboardTask) => {
    onJumpToLink(`/items?item=${task.id}`, task.workspaceId);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(isEn ? 'en-US' : 'ja-JP', {
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minWidth: 0, flexDirection: 'column', position: 'relative' }}>
      {/* ヘッダー */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {onMenuClick && (
            <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
              <Menu size={20} />
            </button>
          )}
          <h1 className="channel-info-title" style={{ margin: 0 }}>🏠 {isEn ? 'Home' : 'ホーム'}</h1>
          <span className="channel-info-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isEn ? 'Overview of your tasks, schedule, and recent events across the organization.' : '全ワークスペースを横断して、あなたの予定やタスク、組織内の最新のアクティビティを一覧します。'}
          </span>
        </div>
      </div>

      {loading && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: 0,
          right: 0,
          padding: '8px 24px',
          background: 'rgba(100,108,255,0.08)',
          backdropFilter: 'blur(4px)',
          color: 'var(--primary-color)',
          fontSize: '12px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(100,108,255,0.2)',
          zIndex: 10
        }}>
          {t('loading')}
        </div>
      )}

      {/* コンテンツエリア */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
        
        {/* ワークスペース一覧セクション */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Globe size={18} style={{ color: 'var(--primary-color)' }} />
            <span>{isEn ? 'My Workspaces' : '参加中のワークスペース'}</span>
          </h2>

          <div 
            className="dashboard-workspaces-scroll"
            style={{ 
              display: 'flex', 
              overflowX: 'auto', 
              gap: '16px', 
              paddingBottom: '12px',
              width: '100%',
              scrollSnapType: 'x mandatory'
            }}
          >
            {sortedWorkspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => onSelectWorkspace(ws.id)}
                className="dashboard-workspace-card dashboard-card"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  position: 'relative',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  scrollSnapAlign: 'start'
                }}
              >
                {/* ワークスペースアイコン */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  flexShrink: 0
                }}>
                  {ws.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.name}
                  </span>
                </div>
                {/* 未読カウントバッジ */}
                {ws.unreadCount !== undefined && ws.unreadCount > 0 && (
                  <span style={{
                    background: 'var(--accent-danger)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    lineHeight: '1'
                  }}>
                    {ws.unreadCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 予定・タスクと新着アクティビティのグリッド */}
        <div className="dashboard-content" style={{ display: 'flex', gap: '24px', minWidth: 0 }}>
        
        {/* 左側: 予定とタスク */}
        <div className="dashboard-column-left" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--primary-color)' }} />
            {isEn ? 'My Tasks & Schedule' : '自分のタスク・予定'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            {myTasks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-muted)', gap: '8px' }}>
                <CheckSquare size={32} strokeWidth={1} style={{ opacity: 0.5 }} />
                <p style={{ fontSize: '13px' }}>{isEn ? 'No incomplete tasks' : '未完了のタスクはありません'}</p>
              </div>
            ) : (
              myTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="dashboard-card"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '11px', background: 'var(--accent-primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {task.workspaceName}
                    </span>
                    {task.priority !== 'none' && (
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: getPriorityColor(task.priority), textTransform: 'uppercase' }}>
                        {isEn ? `Priority: ${task.priority}` : `優先度: ${task.priority}`}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {task.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      {getStatusLabel(task.status)}
                    </span>
                    {(task.startAt || task.endAt) && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {task.endAt ? formatTime(task.endAt) : formatTime(task.startAt || '')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右側: 組織の新着アクティビティ */}
        <div className="dashboard-column-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} style={{ color: '#10b981' }} />
            {isEn ? "What's New" : '最近のイベント'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            {activities.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-muted)', gap: '8px' }}>
                <Clock size={32} strokeWidth={1} style={{ opacity: 0.5 }} />
                <p style={{ fontSize: '13px' }}>{isEn ? 'No recent events' : '最近のイベントはありません'}</p>
              </div>
            ) : (
              activities.map((act, index) => (
                <div
                  key={`${act.type}-${act.id}-${index}`}
                  onClick={() => handleActivityClick(act)}
                  className="dashboard-card"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'all 0.15s',
                  }}
                >
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
                    {getActivityIcon(act.type)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {act.workspaceName}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatTime(act.createdAt)}
                      </span>
                    </div>
                    
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      {getActivityActionLabel(act.type, act.userName || null)}
                    </p>

                    <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '2px 0 0 0', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {act.title}
                    </h4>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      </div>
    </div>
  );
};

