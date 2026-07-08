import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, Loader, Calendar, User, Maximize2, Minimize2, X } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  startAt?: string;
  endAt?: string;
  creatorName?: string;
}

interface ChatTasksPanelProps {
  workspaceId: string | null;
  channelId: string | null;
  onAddTask: () => void;
  onClose?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
}

export const ChatTasksPanel: React.FC<ChatTasksPanelProps> = ({
  workspaceId,
  channelId,
  onAddTask,
  onClose,
  onToggleFullScreen,
  isFullScreen = false,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');

  const loadChannelTasks = useCallback(async () => {
    if (!workspaceId || !channelId) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: Task[] }>(
        `/api/workspaces/${workspaceId}/items?channelId=${channelId}`
      );
      if (res.success && Array.isArray(res.data)) {
        setTasks(res.data);
      }
    } catch (err) {
      console.error('Failed to load channel tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, channelId]);

  useEffect(() => {
    loadChannelTasks();
  }, [loadChannelTasks]);

  const handleStatusChange = async (taskId: string, currentStatus: string, newStatus: string) => {
    if (currentStatus === newStatus) return;
    try {
      const res = await apiClient.put<{ success: boolean }>(`/api/items/${taskId}`, {
        status: newStatus,
      });
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      alert((isEn ? 'Failed to update task status: ' : 'タスクの更新に失敗しました: ') + err);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'all') return true;
    return task.status === statusFilter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'var(--accent-danger)';
      case 'medium':
        return 'var(--accent-warning)';
      case 'low':
        return 'var(--accent-success)';
      default:
        return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', borderLeft: '1px solid var(--border-light)', background: 'var(--bg-main)', position: 'relative' }}>
      {/* パネルヘッダー */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckSquare size={18} style={{ color: 'var(--primary-color)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            {isEn ? 'Channel Tasks' : 'チャネルタスク'}
          </h3>
        </div>
      </div>

      {/* フローティングアクションパネル */}
      <div 
        className="document-floating-actions"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          background: 'var(--bg-panel, rgba(30, 30, 46, 0.85))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid var(--border-light)',
          padding: '8px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          transition: 'opacity 0.2s ease',
          opacity: 0.8,
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
      >
        {/* 1. タスク追加ボタン */}
        <button
          onClick={onAddTask}
          title={isEn ? 'Add Task' : 'タスクを追加'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '6px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Plus size={16} />
        </button>

        {/* 縦配置用の区切り線 */}
        {(onToggleFullScreen || onClose) && (
          <div style={{ height: '1px', width: '16px', background: 'var(--border-light)', margin: '2px 0' }} />
        )}

        {/* 2. 全画面ボタン */}
        {onToggleFullScreen && (
          <button
            onClick={onToggleFullScreen}
            title={isFullScreen ? (isEn ? 'Exit fullscreen' : '通常表示に戻す') : (isEn ? 'Enter fullscreen' : '全画面表示にする')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}

        {/* 3. 閉じるボタン */}
        {onClose && (
          <button
            onClick={onClose}
            title={isEn ? 'Close' : '閉じる'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* フィルタータブ */}
      <div style={{ display: 'flex', padding: '8px 12px', gap: '4px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        {(['all', 'todo', 'in_progress', 'done'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              background: statusFilter === status ? 'var(--bg-panel)' : 'transparent',
              color: statusFilter === status ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: statusFilter === status ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {status === 'all' ? (isEn ? 'All' : 'すべて') : status === 'todo' ? 'To Do' : status === 'in_progress' ? (isEn ? 'In Progress' : '進行中') : (isEn ? 'Done' : '完了')}
          </button>
        ))}
      </div>

      {/* タスクリスト */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader className="animate-spin" size={18} style={{ margin: '0 auto 8px' }} />
            <span>{isEn ? 'Loading tasks...' : '読み込み中...'}</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {isEn ? 'No tasks found.' : 'タスクが見つかりませんでした。'}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.1s, box-shadow 0.1s',
                cursor: 'default',
              }}
            >
              {/* タイトルと優先度 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {task.title}
                </span>
                {task.priority !== 'none' && (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${getPriorityColor(task.priority)}`,
                      color: getPriorityColor(task.priority),
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    {task.priority}
                  </span>
                )}
              </div>

              {/* タスク詳細・説明（あれば） */}
              {task.description && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {task.description}
                </p>
              )}

              {/* 属性（日付、作成者） */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '8px', marginTop: '4px' }}>
                {(task.startAt || task.endAt) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    <span>
                      {task.startAt ? new Date(task.startAt).toLocaleDateString() : ''}
                      {task.startAt && task.endAt ? ' ~ ' : ''}
                      {task.endAt ? new Date(task.endAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                )}
                {task.creatorName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} />
                    <span>{task.creatorName}</span>
                  </div>
                )}
              </div>

              {/* ステータス切替 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {isEn ? 'Status:' : 'ステータス:'}
                </span>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, task.status, e.target.value)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    background: 'var(--bg-input, rgba(255,255,255,0.05))',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">{isEn ? 'In Progress' : '進行中'}</option>
                  <option value="done">{isEn ? 'Done' : '完了'}</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
