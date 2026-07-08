import React, { useState, useEffect } from 'react';
import { Plus, ListTodo, Calendar as CalendarIcon, User, ArrowRight, ArrowLeft, CheckCircle2, Lock, ChevronLeft, ChevronRight, Clock, Filter, Grid, List, Tag, AlertTriangle, Menu, Maximize2, Minimize2, X } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { CreateItemModal } from './CreateItemModal';
import { stripMarkdown } from '../utils/markdown';
import { useLanguage } from '../utils/i18n';

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  type?: string;
}

interface WorkspaceMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}

interface Item {
  id: string;
  workspaceId: string;
  creatorId: string;
  creatorName: string;
  assignees: { userId: string; displayName: string; avatarUrl: string | null }[];
  channels: { id: string; name: string }[];
  title: string;
  description: string;
  status: string;
  priority: string;
  tags: string[];
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  isPrivate: boolean;
  createdAt: string;
}

interface ItemsAreaProps {
  workspaceId: string | null;
  workspace: { id: string; name: string; custom_statuses?: string } | null;
  activeChannelId: string | null;
  channels: Channel[];
  workspaceMembers: WorkspaceMember[];
  currentUserId: string;
  highlightItemId?: string | null;
  onClearHighlightItem?: () => void;
  onMenuClick?: () => void;
  isChatMode?: boolean;
  onClose?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
}

export const ItemsArea: React.FC<ItemsAreaProps> = ({
  workspaceId,
  workspace,
  activeChannelId,
  channels,
  workspaceMembers,
  currentUserId,
  highlightItemId,
  onClearHighlightItem,
  onMenuClick,
  isChatMode = false,
  onClose,
  onToggleFullScreen,
  isFullScreen = false,
}) => {
  const { t } = useLanguage();
  const [view, setView] = useState<'kanban' | 'calendar' | 'list' | 'timeline'>('kanban');
  const [filter, setFilter] = useState<'all' | 'mine' | 'created'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // カレンダー用状態
  const [currentDate, setCurrentDate] = useState(new Date());

  // モーダル用状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalInitialType, setModalInitialType] = useState<'task' | 'event' | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ワークスペースに設定されたカスタムステータスをロード（なければデフォルト3種）
  const workspaceStatuses = workspace?.custom_statuses 
    ? workspace.custom_statuses.split(',').filter(Boolean)
    : ['todo', 'in_progress', 'done'];

  // データフェッチ
  const loadItems = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        filter,
      };

      // チャットモードかつ特定のチャンネルIDがある場合、チャンネルで絞り込み
      if (isChatMode && activeChannelId) {
        params.channelId = activeChannelId;
      }

      // カレンダー表示中のみ、期間でさらに絞り込む（前月1日から翌々月0日=当々月末まで）
      if (view === 'calendar') {
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month + 2, 0).toISOString();
        params.start = startOfMonth;
        params.end = endOfMonth;
      }

      const res = await apiClient.get<{ success: boolean; data: Item[] }>(
        `/api/workspaces/${workspaceId}/items`,
        params
      );
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [workspaceId, view, filter, year, month, activeChannelId]);

  // 通知等からのスマートジャンプによるタスク自動オープン
  useEffect(() => {
    if (highlightItemId && items.length > 0) {
      const item = items.find(i => i.id === highlightItemId);
      if (item) {
        openEditModal(item);
        onClearHighlightItem?.();
      }
    }
  }, [highlightItemId, items, onClearHighlightItem]);

  // タスクに存在するすべてのタグを一意に抽出（タグフィルター用）
  const allUniqueTags = Array.from(new Set(items.flatMap(item => item.tags || [])));

  // フロントエンド側での動的フィルタリング
  const filteredItems = items.filter(item => {
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesTag = tagFilter === 'all' || (item.tags && item.tags.includes(tagFilter));
    const matchesChannel = channelFilter === 'all' || (item.channels && item.channels.some(c => c.id === channelFilter));
    return matchesPriority && matchesTag && matchesChannel;
  });

  // タイムラインのタスクバー位置算出関数
  const calculateBarPosition = (item: Item, days: Date[], colWidth: number) => {
    if (!item.startAt && !item.endAt) {
      return { left: null, width: null };
    }

    const start = item.startAt ? new Date(item.startAt) : (item.endAt ? new Date(item.endAt) : new Date());
    const end = item.endAt ? new Date(item.endAt) : start;

    const startZero = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endZero = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const monthStart = days[0];
    const monthEnd = days[days.length - 1];

    if (endZero < monthStart || startZero > monthEnd) {
      return { left: null, width: null };
    }

    const clipStart = startZero < monthStart ? monthStart : startZero;
    const clipEnd = endZero > monthEnd ? monthEnd : endZero;

    const oneDay = 24 * 60 * 60 * 1000;
    const startIndex = Math.floor((clipStart.getTime() - monthStart.getTime()) / oneDay);
    const endIndex = Math.floor((clipEnd.getTime() - monthStart.getTime()) / oneDay);

    const left = startIndex * colWidth;
    const width = (endIndex - startIndex + 1) * colWidth;

    return { left, width };
  };

  // クイックステータス更新
  const handleUpdateStatus = async (itemId: string, currentItem: Item, newStatus: string) => {
    try {
      // API送信時はIDリストにマッピングして送信する
      const assigneeIds = currentItem.assignees.map(a => a.userId);
      const channelIds = currentItem.channels.map(c => c.id);

      await apiClient.put(`/api/items/${itemId}`, {
        ...currentItem,
        assigneeIds,
        channelIds,
        status: newStatus
      });
      loadItems();
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to update status: ' : 'ステータスの更新に失敗しました: ') + (err.message || err));
    }
  };

  // アイテム保存
  const handleSaveItem = async (itemData: {
    id?: string;
    title: string;
    description: string;
    assigneeIds: string[];
    status: string;
    priority: string;
    tags: string[];
    startAt: string | null;
    endAt: string | null;
    isAllDay: boolean;
    isPrivate: boolean;
    channelIds: string[];
  }) => {
    if (!workspaceId) return;

    if (itemData.id) {
      await apiClient.put(`/api/items/${itemData.id}`, itemData);
    } else {
      await apiClient.post(`/api/workspaces/${workspaceId}/items`, itemData);
    }
    loadItems();
  };

  // アイテム削除
  const handleDeleteItem = async (itemId: string) => {
    await apiClient.delete(`/api/items/${itemId}`);
    loadItems();
  };

  // モーダルオープン関数
  const openCreateModal = (type: 'task' | 'event', dateStr?: string) => {
    setSelectedItem(null);
    setSelectedDate(dateStr || null);
    setModalInitialType(type);
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setSelectedItem(item);
    setSelectedDate(null);
    setModalInitialType(null);
    setIsModalOpen(true);
  };

  // カレンダー用：前月/翌月/今日
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // カレンダーグリッド生成（42日分）
  const generateDaysGrid = () => {
    const startDay = new Date(year, month, 1).getDay();
    const prevMonthEnd = new Date(year, month, 0).getDate();
    const days = [];

    // 前月の日付
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthEnd - i),
        isCurrentMonth: false,
      });
    }
    // 当月の日付
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    // 翌月の日付
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    return days;
  };

  const daysGrid = generateDaysGrid();

  // 特定日付のアイテム（startAt が存在するアイテムのうち、範囲内にあるもの）
  const getItemsForDate = (date: Date) => {
    return filteredItems.filter(item => {
      if (!item.startAt) return false;
      const start = new Date(item.startAt);
      const end = item.endAt ? new Date(item.endAt) : start;

      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(end);
      endDate.setHours(0, 0, 0, 0);

      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  // 優先度バッジのカラーマッピング
  const getPriorityStyle = (priority: string) => {
    const isEn = t('error') === 'Error';
    switch (priority) {
      case 'high':
        return { color: '#ef4444', label: isEn ? 'High' : '高', bg: 'rgba(239, 68, 68, 0.12)' };
      case 'medium':
        return { color: '#f59e0b', label: isEn ? 'Med' : '中', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'low':
        return { color: '#3b82f6', label: isEn ? 'Low' : '低', bg: 'rgba(59, 130, 246, 0.12)' };
      default:
        return null;
    }
  };

  // 複数担当者アバターのレンダリング
  const renderAssignees = (item: Item) => {
    if (!item.assignees || item.assignees.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <User size={12} />
          <span>{t('error') === 'Error' ? 'Unassigned' : '未アサイン'}</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {item.assignees.map(a => {
          const initials = a.displayName ? a.displayName.slice(0, 2) : '??';
          return (
            <div key={a.userId} style={{ display: 'flex', alignItems: 'center' }} title={t('error') === 'Error' ? `Assignee: ${a.displayName}` : `担当: ${a.displayName}`}>
              {a.avatarUrl ? (
                <img
                  src={a.avatarUrl}
                  alt={a.displayName}
                  style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              ) : (
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(100,108,255,0.2)', color: '#fff', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {initials}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // かんばん用タスクカード
  const renderTaskCard = (item: Item) => {
    const overdue = item.endAt && item.status !== 'done' && new Date(item.endAt) < new Date();
    const formattedDue = item.endAt ? new Date(item.endAt).toLocaleDateString(t('error') === 'Error' ? 'en-US' : 'ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const statusIndex = workspaceStatuses.indexOf(item.status);
    const priorityStyle = getPriorityStyle(item.priority);
    const isEn = t('error') === 'Error';

    return (
      <div
        key={item.id}
        onClick={() => openEditModal(item)}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: '6px',
          padding: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: 'transform 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = 'var(--border-light)';
        }}
      >
        {/* ヘッダー (公開チャンネル一覧表示) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '4px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            {item.channels && item.channels.length > 0 ? (
              item.channels.map(chan => (
                <span key={chan.id} style={{ fontSize: '9px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                  # {chan.name}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '9px', color: 'var(--text-disabled)' }}>{isEn ? 'Unlinked' : '紐付けなし'}</span>
            )}
            {item.startAt && (
              <span title={isEn ? 'Registered in calendar' : 'カレンダー登録あり'} style={{ color: 'var(--primary-color)', display: 'inline-flex' }}>
                <CalendarIcon size={11} />
              </span>
            )}
          </div>
          {item.isPrivate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
              <Lock size={9} />
              <span>{isEn ? 'Private' : '非公開'}</span>
            </div>
          )}
        </div>

        {/* 優先度 ＆ タグ */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          {priorityStyle && (
            <span style={{ fontSize: '9px', fontWeight: 'bold', background: priorityStyle.bg, color: priorityStyle.color, padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
              {priorityStyle.label}
            </span>
          )}
          {item.tags && item.tags.map(t => (
            <span key={t} style={{ fontSize: '9px', background: 'rgba(14, 165, 233, 0.12)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <Tag size={8} />
              <span>{t}</span>
            </span>
          ))}
        </div>

        {/* タイトル */}
        <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)', wordBreak: 'break-all', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          {item.status === 'done' && <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />}
          <span>{item.title}</span>
        </h4>

        {/* 説明 */}
        {item.description && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-all' }}>
            {stripMarkdown(item.description)}
          </p>
        )}

        {/* 下部 (期限・アサイン・クイック移動) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {item.endAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: overdue ? 'var(--accent-danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                <Clock size={11} />
                <span>{formattedDue}</span>
                {overdue && <span style={{ fontSize: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '0 4px', borderRadius: '2px', color: '#ef4444' }}>{isEn ? 'Overdue' : '期限切れ'}</span>}
              </div>
            )}
            {renderAssignees(item)}
          </div>

          {/* クイック移動ボタン */}
          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
            {statusIndex > 0 && (
              <button
                title={isEn ? `Back to ${workspaceStatuses[statusIndex - 1]}` : `${workspaceStatuses[statusIndex - 1]} に戻す`}
                onClick={() => handleUpdateStatus(item.id, item, workspaceStatuses[statusIndex - 1])}
                style={{ background: 'var(--border-light)', border: 'none', color: 'var(--text-primary)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ArrowLeft size={12} />
              </button>
            )}
            {statusIndex < workspaceStatuses.length - 1 && (
              <button
                title={isEn ? `Move to ${workspaceStatuses[statusIndex + 1]}` : `${workspaceStatuses[statusIndex + 1]} に進める`}
                onClick={() => handleUpdateStatus(item.id, item, workspaceStatuses[statusIndex + 1])}
                style={{ background: 'var(--border-light)', border: 'none', color: 'var(--text-primary)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // リスト用タスク行
  const renderListRow = (item: Item) => {
    const overdue = item.endAt && item.status !== 'done' && new Date(item.endAt) < new Date();
    const formattedDue = item.endAt ? new Date(item.endAt).toLocaleDateString(t('error') === 'Error' ? 'en-US' : 'ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const priorityStyle = getPriorityStyle(item.priority);
    const isEn = t('error') === 'Error';

    return (
      <div
        key={item.id}
        onClick={() => openEditModal(item)}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: '6px',
          padding: '10px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          e.currentTarget.style.borderColor = 'var(--border-light)';
        }}
      >
        {/* 左側: ステータス、タイトル、タグ、優先度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {/* 簡易完了チェック */}
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
            {item.status === 'done' ? (
              <button
                title={isEn ? 'Mark as incomplete' : '未完了に戻す'}
                onClick={() => handleUpdateStatus(item.id, item, workspaceStatuses[0] || 'todo')}
                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <CheckCircle2 size={18} />
              </button>
            ) : (
              <button
                title={isEn ? 'Mark as complete' : '完了にする'}
                onClick={() => handleUpdateStatus(item.id, item, 'done')}
                style={{
                  background: 'none',
                  border: '2px solid var(--text-muted)',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
            )}
          </div>

          {/* タイトル */}
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: item.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: item.status === 'done' ? 'line-through' : 'none',
            wordBreak: 'break-all',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {item.title}
          </span>

          {/* 各種バッジ・優先度・タグ */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            {priorityStyle && (
              <span style={{ fontSize: '9px', fontWeight: 'bold', background: priorityStyle.bg, color: priorityStyle.color, padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                {priorityStyle.label}
              </span>
            )}
            {item.tags && item.tags.map(t => (
              <span key={t} style={{ fontSize: '9px', background: 'rgba(14, 165, 233, 0.12)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                <Tag size={8} />
                <span>{t}</span>
              </span>
            ))}
            {item.channels && item.channels.map(chan => (
              <span key={chan.id} style={{ fontSize: '9px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                # {chan.name}
              </span>
            ))}
            {item.isPrivate && (
              <span title={isEn ? 'Private' : '非公開'} style={{ color: '#f59e0b', display: 'inline-flex' }}>
                <Lock size={12} />
              </span>
            )}
            {item.startAt && (
              <span title={isEn ? 'Registered in calendar' : 'カレンダー登録あり'} style={{ color: 'var(--primary-color)', display: 'inline-flex' }}>
                <CalendarIcon size={12} />
              </span>
            )}
          </div>
        </div>

        {/* 右側: 担当者、期限 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
          {/* 担当者 */}
          <div style={{ width: '120px', display: 'flex', justifyContent: 'flex-start' }}>
            {renderAssignees(item)}
          </div>

          {/* 期限 */}
          <div style={{ width: '130px', display: 'flex', justifyContent: 'flex-end' }}>
            {item.endAt ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: overdue ? 'var(--accent-danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                <Clock size={12} />
                <span>{formattedDue}</span>
                {overdue && <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.1)', padding: '0 4px', borderRadius: '2px', marginLeft: '4px', color: '#ef4444' }}>{isEn ? 'Overdue' : '期限切れ'}</span>}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>{isEn ? 'No deadline' : '期限なし'}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const isEn = t('error') === 'Error';
  const weekdays = isEn 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['日', '月', '火', '水', '木', '金', '土'];
  const todayStr = new Date().toLocaleDateString('ja-JP');

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minWidth: 0, position: 'relative' }}>
      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {/* 1. タイトルヘッダー - チャットモード以外で表示 */}
        {!isChatMode && (
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              {onMenuClick && (
                <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                  <Menu size={20} />
                </button>
              )}
              <h1 className="channel-info-title" style={{ margin: 0 }}>{t('error') === 'Error' ? 'Tasks & Schedule' : 'タスク・予定一覧'}</h1>
              <span className="channel-info-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('error') === 'Error' ? 'Centralized management of workspace progress, Kanban, and calendar.' : 'ワークスペース内の進捗、かんばん、予定表を一元管理します。'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              {/* モバイル用表示切替セレクトボックス */}
              <select
                value={view}
                onChange={(e) => setView(e.target.value as any)}
                className="items-view-select-mobile"
                style={{
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="kanban">{t('error') === 'Error' ? 'Kanban' : 'かんばん'}</option>
                <option value="list">{t('error') === 'Error' ? 'List' : 'リスト'}</option>
                <option value="calendar">{t('error') === 'Error' ? 'Calendar' : 'カレンダー'}</option>
                <option value="timeline">{t('error') === 'Error' ? 'Timeline' : 'タイムライン'}</option>
              </select>

              {/* 追加ボタン */}
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                onClick={() => openCreateModal(view === 'calendar' ? 'event' : 'task')}
              >
                <Plus size={16} />
                <span className="channel-members-count-text">{t('error') === 'Error' ? 'New Task' : '新規作成'}</span>
              </button>
            </div>
          </div>
        )}

        {/* チャットモード用フローティングアクション */}
        {isChatMode && (
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
            {/* 1. 追加ボタン */}
            <button
              onClick={() => openCreateModal(view === 'calendar' ? 'event' : 'task')}
              title={t('error') === 'Error' ? 'New Task' : '新規作成'}
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
                title={isFullScreen ? (t('error') === 'Error' ? 'Exit fullscreen' : '通常表示に戻す') : (t('error') === 'Error' ? 'Enter fullscreen' : '全画面表示にする')}
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
        )}

      {/* 2. 表示切替タブバー */}
      <div className="items-view-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)', padding: '0 24px', flexShrink: 0 }}>
        <button
          onClick={() => setView('kanban')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: view === 'kanban' ? '600' : '500',
            color: view === 'kanban' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: view === 'kanban' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          <Grid size={14} />
          <span>{t('error') === 'Error' ? 'Kanban' : 'かんばん'}</span>
        </button>
        <button
          onClick={() => setView('list')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: view === 'list' ? '600' : '500',
            color: view === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: view === 'list' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          <List size={14} />
          <span>{t('error') === 'Error' ? 'List' : 'リスト'}</span>
        </button>
        <button
          onClick={() => setView('calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: view === 'calendar' ? '600' : '500',
            color: view === 'calendar' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: view === 'calendar' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          <CalendarIcon size={14} />
          <span>{t('error') === 'Error' ? 'Calendar' : 'カレンダー'}</span>
        </button>
        <button
          onClick={() => setView('timeline')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: view === 'timeline' ? '600' : '500',
            color: view === 'timeline' ? 'var(--accent-primary)' : 'var(--text-muted)',
            border: 'none',
            background: 'none',
            borderBottom: view === 'timeline' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '-1px'
          }}
        >
          <Clock size={14} />
          <span>{t('error') === 'Error' ? 'Timeline' : 'タイムライン'}</span>
        </button>
      </div>

      {/* 2-2. フィルターバー */}
      <div className="items-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div className="items-filter-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Filter size={13} />
          <span>{t('error') === 'Error' ? 'Filter:' : 'フィルター:'}</span>
        </div>

        {/* アサイン・作成者フィルター */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          style={{
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '5px 10px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'All Tasks' : '全員のタスク'}</option>
          <option value="mine" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'My Tasks' : '自分担当'}</option>
          <option value="created" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'Created by me' : '自分が作成'}</option>
        </select>

        {/* 優先度フィルター */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '5px 10px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'All Priorities' : 'すべての優先度'}</option>
          <option value="high" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'Priority: High' : '優先度: 高'}</option>
          <option value="medium" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'Priority: Med' : '優先度: 中'}</option>
          <option value="low" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'Priority: Low' : '優先度: 低'}</option>
          <option value="none" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'No Priority' : '優先度なし'}</option>
        </select>

        {/* タグフィルター */}
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={{
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '5px 10px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer',
            maxWidth: '150px'
          }}
        >
          <option value="all" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'All Tags' : 'すべてのタグ'}</option>
          {allUniqueTags.map(tag => (
            <option key={tag} value={tag} style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>#{tag}</option>
          ))}
        </select>

        {/* チャンネルフィルター - チャットモード以外で表示 */}
        {!isChatMode && (
          <select
            value={channelFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            style={{
              background: 'var(--bg-sidebar)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '5px 10px',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '180px'
            }}
          >
            <option value="all" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{t('error') === 'Error' ? 'All Channels' : 'すべてのチャンネル'}</option>
            {channels.map(c => {
              let prefix = c.isPrivate ? '🔒 ' : '# ';
              if (c.type === 'dm') prefix = '💬 ';
              return (
                <option key={c.id} value={c.id} style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>
                  {prefix}{c.name}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {/* 同期ステータス */}
      {loading && (
        <div style={{ padding: '8px 24px', background: 'rgba(100,108,255,0.05)', color: 'var(--primary-color)', fontSize: '12px', textAlign: 'center' }}>
          {t('loading')}
        </div>
      )}

      {/* 2. メイン表示コンテンツ */}
      {view === 'kanban' ? (
        /* 動的かんばんボード（カスタムステータス対応） */
        <div style={{ flex: 1, display: 'flex', gap: '20px', padding: '24px', overflowX: 'auto', alignItems: 'flex-start' }}>
          {workspaceStatuses.map(status => {
            const statusItems = filteredItems.filter(i => i.status === status);
            return (
              <div 
                key={status} 
                style={{ 
                  flex: '1 0 280px', 
                  maxWidth: '350px',
                  display: 'flex', 
                  flexDirection: 'column', 
                  background: 'rgba(255,255,255,0.015)', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-light)', 
                  maxHeight: '100%' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '2px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === 'done' ? '#10b981' : status === 'in_progress' ? 'var(--primary-color)' : '#9ca3af' }}></span>
                    <span>{status}</span>
                  </h3>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                    {statusItems.length}
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '300px' }}>
                  {statusItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '12px', color: 'var(--text-muted)' }}>{t('error') === 'Error' ? 'No tasks' : 'タスクはありません'}</div>
                  ) : (
                    statusItems.map(item => renderTaskCard(item))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'list' ? (
        /* リストビュー */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', overflowY: 'auto' }}>
          {workspaceStatuses.map(status => {
            const statusItems = filteredItems.filter(i => i.status === status);
            return (
              <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === 'done' ? '#10b981' : status === 'in_progress' ? 'var(--primary-color)' : '#9ca3af' }}></span>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#f3f4f6', margin: 0 }}>
                    {status}
                  </h3>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                    {statusItems.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {statusItems.length === 0 ? (
                    <div style={{ padding: '16px 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('error') === 'Error' ? 'No tasks' : 'タスクはありません'}</div>
                  ) : (
                    statusItems.map(item => renderListRow(item))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'calendar' ? (
        /* カレンダービュー */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', overflowY: 'auto' }}>
          {/* 月切替コントロール */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)', minWidth: '120px' }}>
              {t('error') === 'Error' ? `${year}-${month + 1}` : `${year}年 ${month + 1}月`}
            </h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={handlePrevMonth}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleToday}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
              >
                {t('error') === 'Error' ? 'Today' : '今日'}
              </button>
              <button
                onClick={handleNextMonth}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden', minHeight: '400px' }}>
            {/* 曜日 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.03)' }}>
              {weekdays.map((day, idx) => (
                <div
                  key={day}
                  style={{
                    padding: '10px 0',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    color: idx === 0 ? 'var(--accent-danger)' : idx === 6 ? '#3b82f6' : 'var(--text-muted)',
                    borderRight: idx < 6 ? '1px solid var(--border-light)' : 'none',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 日付グリッド */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', flex: 1 }}>
              {daysGrid.map((dayInfo, idx) => {
                const dayItems = getItemsForDate(dayInfo.date);
                const isToday = dayInfo.date.toLocaleDateString('ja-JP') === todayStr;
                const dateIsoStr = dayInfo.date.toISOString().split('T')[0];

                return (
                  <div
                    key={idx}
                    onClick={() => openCreateModal('event', dateIsoStr)}
                    style={{
                      padding: '8px',
                      borderBottom: idx < 35 ? '1px solid var(--border-light)' : 'none',
                      borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-light)' : 'none',
                      background: isToday ? 'rgba(var(--primary-color-rgb, 100, 108, 255), 0.05)' : dayInfo.isCurrentMonth ? 'transparent' : 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '80px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isToday ? 'rgba(var(--primary-color-rgb, 100, 108, 255), 0.08)' : 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isToday ? 'rgba(var(--primary-color-rgb, 100, 108, 255), 0.05)' : dayInfo.isCurrentMonth ? 'transparent' : 'rgba(255,255,255,0.01)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isToday ? 'bold' : 'normal',
                          color: isToday ? 'var(--primary-color)' : dayInfo.isCurrentMonth ? 'var(--text-primary)' : 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: isToday ? '24px' : 'auto',
                          height: isToday ? '24px' : 'auto',
                          borderRadius: isToday ? '50%' : 'none',
                          background: isToday ? 'rgba(var(--primary-color-rgb, 100, 108, 255), 0.15)' : 'none',
                        }}
                      >
                        {dayInfo.date.getDate()}
                      </span>
                      {dayItems.length > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px' }}>
                          {t('error') === 'Error' ? `${dayItems.length} items` : `${dayItems.length}件`}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'hidden' }}>
                      {dayItems.slice(0, 3).map(item => {
                        const startTime = item.startAt ? new Date(item.startAt).toLocaleTimeString(t('error') === 'Error' ? 'en-US' : 'ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';
                        const eventBg = item.isPrivate ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 108, 255, 0.15)';
                        const eventBorder = item.isPrivate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(100, 108, 255, 0.4)';
                        const eventTextColor = item.isPrivate ? '#f59e0b' : '#a5b4fc';

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(item);
                            }}
                            style={{
                              fontSize: '11px',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: eventBg,
                              border: eventBorder,
                              color: eventTextColor,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'transform 0.1s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title={`${item.title} (${item.isAllDay ? (t('error') === 'Error' ? 'All Day' : '終日') : startTime})`}
                          >
                            {item.isPrivate && <Lock size={10} style={{ flexShrink: 0 }} />}
                            {item.status === 'done' && <CheckCircle2 size={10} style={{ color: '#10b981', flexShrink: 0 }} />}
                            {!item.isAllDay && <Clock size={10} style={{ flexShrink: 0, opacity: 0.7 }} />}
                            <span>{item.title}</span>
                          </div>
                        );
                      })}
                      {dayItems.length > 3 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                          {t('error') === 'Error' ? `+ ${dayItems.length - 3} more` : `他 ${dayItems.length - 3} 件`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* タイムライン（ガントチャート）ビュー */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', overflow: 'hidden' }}>
          {/* 月切替コントロール */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexShrink: 0 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)', minWidth: '120px' }}>
              {t('error') === 'Error' ? `${year}-${month + 1}` : `${year}年 ${month + 1}月`}
            </h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={handlePrevMonth}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleToday}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
              >
                {t('error') === 'Error' ? 'Today' : '今日'}
              </button>
              <button
                onClick={handleNextMonth}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'var(--bg-secondary)',
          }}>
            {/* タイムラインヘッダー */}
            <div style={{ display: 'flex', height: '40px', borderBottom: '1px solid var(--border-light)', flexShrink: 0, overflow: 'hidden' }}>
              <div className="timeline-name-header" style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                {t('error') === 'Error' ? 'Task Name' : 'タスク名'}
              </div>
              <div 
                id="timeline-header-scroll" 
                style={{ flex: 1, overflowX: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.01)' }}
              >
                <div style={{ display: 'flex', width: `${daysGrid.filter(d => d.isCurrentMonth).length * 60}px`, flexShrink: 0 }}>
                  {daysGrid.filter(d => d.isCurrentMonth).map((dayInfo, idx) => {
                    const dayNum = dayInfo.date.getDate();
                    const dayOfWeek = dayInfo.date.getDay();
                    const isSat = dayOfWeek === 6;
                    const isSun = dayOfWeek === 0;
                    return (
                      <div key={idx} style={{
                        width: '60px',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: isSun ? 'var(--accent-danger)' : isSat ? '#3b82f6' : 'var(--text-muted)',
                        background: isSun ? 'rgba(239, 68, 68, 0.02)' : isSat ? 'rgba(59, 130, 246, 0.02)' : 'none',
                        flexShrink: 0
                      }}>
                        <span style={{ fontWeight: 'bold' }}>{dayNum}</span>
                        <span style={{ fontSize: '9px', opacity: 0.7 }}>{weekdays[dayOfWeek]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* タイムラインボディ */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* 左タスク名リスト */}
              <div 
                id="timeline-names-scroll" 
                className="timeline-name-column"
                style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-light)', overflowY: 'hidden', background: 'rgba(0,0,0,0.08)' }}
              >
                {filteredItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => openEditModal(item)} 
                    style={{ 
                      height: '48px', 
                      borderBottom: '1px solid rgba(255,255,255,0.03)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '0 16px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      color: '#f3f4f6', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {item.title}
                  </div>
                ))}
              </div>

              {/* 右タスクグリッド */}
              <div 
                id="timeline-grid-scroll" 
                style={{ flex: 1, overflow: 'auto' }}
                onScroll={(e) => {
                  const header = document.getElementById("timeline-header-scroll");
                  if (header) header.scrollLeft = e.currentTarget.scrollLeft;

                  const names = document.getElementById("timeline-names-scroll");
                  if (names) names.scrollTop = e.currentTarget.scrollTop;
                }}
              >
                <div style={{ width: `${daysGrid.filter(d => d.isCurrentMonth).length * 60}px`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {filteredItems.map((item) => {
                    const currentMonthDays = daysGrid.filter(d => d.isCurrentMonth).map(d => d.date);
                    const { left, width } = calculateBarPosition(item, currentMonthDays, 60);
                    const statusColor = item.status === 'done' ? '#10b981' : item.status === 'in_progress' ? 'var(--primary-color)' : '#9ca3af';

                    return (
                      <div key={item.id} style={{
                        height: '48px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        {/* 背景の縦線 */}
                        {currentMonthDays.map((day, dIdx) => {
                          const w = day.getDay();
                          return (
                            <div key={dIdx} style={{
                              position: 'absolute',
                              left: `${dIdx * 60}px`,
                              width: '60px',
                              height: '100%',
                              borderRight: '1px solid rgba(255,255,255,0.02)',
                              background: w === 0 ? 'rgba(239, 68, 68, 0.015)' : w === 6 ? 'rgba(59, 130, 246, 0.015)' : 'none',
                              zIndex: 0,
                            }} />
                          );
                        })}

                        {/* タスクバー */}
                        {left !== null && width !== null && (
                          <div
                            onClick={() => openEditModal(item)}
                            style={{
                              position: 'absolute',
                              left: `${left}px`,
                              width: `${width}px`,
                              height: '24px',
                              borderRadius: '12px',
                              background: `linear-gradient(90deg, ${statusColor} 0%, rgba(255,255,255,0.15) 100%)`,
                              border: `1px solid ${statusColor}`,
                              boxShadow: `0 0 8px ${statusColor}20`,
                              zIndex: 1,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 12px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'transform 0.15s, box-shadow 0.15s',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scaleY(1.08)';
                              e.currentTarget.style.boxShadow = `0 0 12px ${statusColor}40`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = `0 0 8px ${statusColor}20`;
                            }}
                            title={`${item.title} (${item.status})`}
                          >
                            {item.title}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 統合モーダル */}
      <CreateItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        channels={channels}
        workspaceMembers={workspaceMembers}
        workspaceStatuses={workspaceStatuses}
        activeChannelId={activeChannelId}
        initialItem={selectedItem}
        initialDate={selectedDate}
        initialType={modalInitialType}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
      </div>
    </div>
  );
};
