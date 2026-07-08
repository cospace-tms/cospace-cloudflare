import React, { useState, useEffect } from 'react';
import { X, Calendar, Trash2, Lock, CheckSquare, Tag } from 'lucide-react';
import { parseMarkdownToHtml } from '../utils/markdown';
import { useLanguage } from '../utils/i18n';

// ============================================================
// ModalBase: モーダルの外枠（オーバーレイ・ヘッダー・フッター）を共通化
// ============================================================
interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: () => void;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  children: React.ReactNode;
}

export const ModalBase: React.FC<ModalBaseProps> = ({
  isOpen,
  onClose,
  title,
  onSubmit,
  onDelete,
  submitLabel,
  submitIcon,
  isSubmitting = false,
  isSubmitDisabled = false,
  children,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const actualSubmitLabel = submitLabel || (isEn ? 'Register' : '登録する');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content settings-modal"
        style={{ maxWidth: '520px', width: '95%', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            className="settings-body"
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', padding: '16px 24px' }}
          >
            {children}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--border-light)', marginTop: 'auto', flexShrink: 0 }}>
            <div>
              {onDelete && (
                <button
                   type="button"
                   onClick={onDelete}
                   style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent-danger)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                   disabled={isSubmitting}
                >
                  <Trash2 size={14} />
                  <span>{isEn ? 'Delete' : '削除'}</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#fff' }}
                disabled={isSubmitting}
              >
                {isEn ? 'Cancel' : 'キャンセル'}
              </button>
              <button
                type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary-color)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: isSubmitDisabled || isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitDisabled || isSubmitting ? 0.7 : 1 }}
                disabled={isSubmitting || isSubmitDisabled}
              >
                {submitIcon}
                <span>{isSubmitting ? (isEn ? 'Saving...' : '保存中...') : actualSubmitLabel}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// 日時を input 用にフォーマットするヘルパー
function formatDateTimeForInput(isoString: string, allDay: boolean): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - offset);
  const formatted = localDate.toISOString().slice(0, 16);
  if (allDay) return formatted.split('T')[0];
  return formatted;
}

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

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  workspaceMembers: WorkspaceMember[];
  workspaceStatuses: string[];
  activeChannelId: string | null;
  initialItem?: Item | any | null;
  initialDate?: string | null; // カレンダーの日付セル選択用
  initialType?: 'task' | 'event' | null; // チャットからのクイック連携用
  onSave: (itemData: {
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
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  isOpen,
  onClose,
  channels,
  workspaceMembers,
  workspaceStatuses,
  activeChannelId,
  initialItem,
  initialDate,
  initialType,
  onSave,
  onDelete,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionMode, setDescriptionMode] = useState<'edit' | 'preview'>('edit');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('none');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // 日時（カレンダー登録）トグル
  const [hasDateTime, setHasDateTime] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  
  const [isPrivate, setIsPrivate] = useState(true);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAllDayChange = (checked: boolean) => {
    setIsAllDay(checked);
    if (checked) {
      setStartAt(prev => prev.split('T')[0] || prev);
      setEndAt(prev => prev.split('T')[0] || prev);
    } else {
      const base = startAt.split('T')[0] || endAt.split('T')[0];
      if (base) {
        setStartAt(`${base}T09:00`);
        setEndAt(`${base}T10:00`);
      }
    }
  };

  const isOpenedRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isOpenedRef.current = false;
      return;
    }
    if (isOpenedRef.current) return;
    isOpenedRef.current = true;

    setDescriptionMode('edit');

    const defaultStatus = workspaceStatuses?.[0] || 'todo';

    if (initialItem) {
      setTitle(initialItem.title);
      setDescription(initialItem.description || '');
      
      const aIds = Array.isArray(initialItem.assignees) 
        ? initialItem.assignees.map((a: any) => a.userId) 
        : (initialItem.assigneeId ? [initialItem.assigneeId] : []);
      setAssigneeIds(aIds);
      
      setStatus(initialItem.status || defaultStatus);
      setPriority(initialItem.priority || 'none');
      setTags(initialItem.tags || []);
      
      const hasStart = !!initialItem.startAt;
      setHasDateTime(hasStart);
      if (hasStart) {
        setStartAt(formatDateTimeForInput(initialItem.startAt!, initialItem.isAllDay));
        setEndAt(initialItem.endAt ? formatDateTimeForInput(initialItem.endAt, initialItem.isAllDay) : '');
      } else {
        setStartAt('');
        setEndAt('');
      }
      
      setIsAllDay(!!initialItem.isAllDay);
      setIsPrivate(!!initialItem.isPrivate);

      const cIds = Array.isArray(initialItem.channels) 
        ? initialItem.channels.map((c: any) => c.id) 
        : (initialItem.channelId ? [initialItem.channelId] : []);
      setChannelIds(cIds);
    } else {
      setTitle('');
      setDescription('');
      setAssigneeIds([]);
      setStatus(defaultStatus);
      setPriority('none');
      setTags([]);
      setTagInput('');
      setIsAllDay(false);

      const isEvent = initialType === 'event' || !!initialDate;
      setHasDateTime(isEvent);

      // 日時の初期化
      const baseDate = initialDate ? new Date(initialDate) : new Date();
      const start = new Date(baseDate);
      if (!initialDate) {
        start.setMinutes(0);
        start.setSeconds(0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      setStartAt(formatDateTimeForInput(start.toISOString(), false));
      setEndAt(formatDateTimeForInput(end.toISOString(), false));

      // 初期チャンネルの紐付け
      const defaultChanId = activeChannelId || '';
      setChannelIds(defaultChanId ? [defaultChanId] : []);

      const activeChanObj = channels.find(c => c.id === defaultChanId);
      if (activeChanObj) {
        setIsPrivate(activeChanObj.isPrivate || activeChanObj.type === 'dm');
      } else {
        setIsPrivate(true);
      }
    }
  }, [isOpen, initialItem, initialDate, initialType, activeChannelId, channels, workspaceStatuses]);

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleChannel = (channelId: string) => {
    setChannelIds(prev => {
      const next = prev.includes(channelId) 
        ? prev.filter(id => id !== channelId) 
        : [...prev, channelId];
      
      // 公開チャンネルが1つも選択されていない場合、またはDMのみの場合は自動的にプライベートにする
      const hasPublic = next.some(cid => {
        const c = channels.find(ch => ch.id === cid);
        return c ? (!c.isPrivate && c.type !== 'dm') : false;
      });
      setIsPrivate(!hasPublic);
      return next;
    });
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleQuickAddTag = (presetTag: string) => {
    if (tags.includes(presetTag)) return;
    setTags([...tags, presetTag]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (hasDateTime && (!startAt || !endAt)) return;
    setSubmitting(true);

    try {
      let isoStart: string | null = null;
      let isoEnd: string | null = null;

      if (hasDateTime) {
        const parsedStart = new Date(startAt);
        const parsedEnd = new Date(endAt);

        if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
          throw new Error(isEn ? 'Invalid date and time. Please enter a valid date.' : "日時の指定が正しくありません。正しい日付を入力してください。");
        }

        if (parsedStart > parsedEnd) {
          throw new Error(isEn ? 'The end time must be after the start time.' : "終了日時は開始日時より後の日時を指定してください。");
        }

        isoStart = parsedStart.toISOString();
        isoEnd = parsedEnd.toISOString();

        if (isAllDay) {
          const s = new Date(startAt);
          s.setHours(0, 0, 0, 0);
          isoStart = s.toISOString();

          const e = new Date(endAt);
          e.setHours(23, 59, 59, 999);
          isoEnd = e.toISOString();
        }
      }

      await onSave({
        id: initialItem?.id,
        title: title.trim(),
        description: description.trim(),
        assigneeIds,
        status,
        priority,
        tags,
        startAt: isoStart,
        endAt: isoEnd,
        isAllDay: hasDateTime ? isAllDay : false,
        isPrivate,
        channelIds,
      });
      onClose();
    } catch (err: any) {
      alert((isEn ? 'Failed to save: ' : '保存に失敗しました: ') + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!initialItem || !onDelete) return;
    const confirmMsg = isEn ? 'Are you sure you want to delete this item?' : 'このアイテムを削除してもよろしいですか？';
    if (!confirm(confirmMsg)) return;
    setSubmitting(true);
    try {
      await onDelete(initialItem.id);
      onClose();
    } catch (err: any) {
      alert((isEn ? 'Failed to delete: ' : '削除に失敗しました: ') + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={initialItem ? (isEn ? 'Edit Item' : 'アイテムを編集') : (isEn ? 'New Item' : '新規アイテムを登録')}
      onSubmit={handleSubmit}
      onDelete={initialItem && onDelete ? handleDeleteClick : undefined}
      submitLabel={initialItem ? (isEn ? 'Save' : '保存する') : (isEn ? 'Register' : '登録する')}
      submitIcon={hasDateTime ? <Calendar size={16} /> : <CheckSquare size={16} />}
      isSubmitting={submitting}
      isSubmitDisabled={!title.trim()}
    >
      {/* タイトル */}
      <div className="form-group">
        <label className="form-label">{isEn ? 'Title' : 'タイトル'} <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
        <input
          type="text"
          placeholder={isEn ? 'Enter task/schedule title' : 'タスク・予定のタイトルを入力してください'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="form-input"
          required
          disabled={submitting}
          autoFocus
        />
      </div>

      {/* 詳細説明 */}
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="form-label" style={{ margin: 0 }}>{isEn ? 'Description (Optional)' : '詳細説明（省略可能）'}</label>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '4px' }}>
            <button
              type="button"
              onClick={() => setDescriptionMode('edit')}
              style={{
                fontSize: '11px',
                border: 'none',
                background: descriptionMode === 'edit' ? 'var(--accent-primary)' : 'transparent',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              {isEn ? 'Edit' : '編集'}
            </button>
            <button
              type="button"
              onClick={() => setDescriptionMode('preview')}
              style={{
                fontSize: '11px',
                border: 'none',
                background: descriptionMode === 'preview' ? 'var(--accent-primary)' : 'transparent',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              {isEn ? 'Preview' : 'プレビュー'}
            </button>
          </div>
        </div>
        {descriptionMode === 'edit' ? (
          <textarea
            placeholder={isEn ? 'Details, notes, locations, etc. (Markdown supported)' : '内容・メモ・場所など（マークダウンが使用できます）'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-textarea"
            style={{ minHeight: '80px' }}
            disabled={submitting}
          />
        ) : (
          <div
            className="document-preview-content"
            style={{
              minHeight: '80px',
              maxHeight: '160px',
              overflowY: 'auto',
              padding: '10px 12px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              fontSize: '13px',
              color: 'var(--text-primary)'
            }}
            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(description) || `<em style="color: var(--text-muted)">${isEn ? 'Nothing to preview.' : 'プレビューする内容がありません。'}</em>` }}
          />
        )}
      </div>

      {/* ステータス & 優先度 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">{isEn ? 'Status' : 'ステータス'}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="form-input"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--border-light)' }}
            disabled={submitting}
          >
            {workspaceStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">{isEn ? 'Priority' : '優先度'}</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="form-input"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--border-light)' }}
            disabled={submitting}
          >
            <option value="none">{isEn ? 'None' : '優先度なし (None)'}</option>
            <option value="low">{isEn ? 'Low' : '低 (Low)'}</option>
            <option value="medium">{isEn ? 'Medium' : '中 (Medium)'}</option>
            <option value="high">{isEn ? 'High' : '高 (High)'}</option>
          </select>
        </div>
      </div>

      {/* 複数担当者選択 */}
      <div className="form-group">
        <label className="form-label">{isEn ? 'Assignees (Multiple selections allowed)' : '担当者（複数選択可能）'}</label>
        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {workspaceMembers.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isEn ? 'No members' : 'メンバーはいません'}</span>
          ) : (
            workspaceMembers.map(m => (
              <label key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(m.userId)}
                  onChange={() => toggleAssignee(m.userId)}
                  style={{ width: '15px', height: '15px', accentColor: 'var(--primary-color)' }}
                  disabled={submitting}
                />
                <span>{m.displayName}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* タグ設定 */}
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Tag size={14} />
          <span>{isEn ? 'Tags (Category)' : 'タグ（カテゴリー）'}</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder={isEn ? 'Enter tag to add (Enter or click Add)' : 'タグを入力して追加（エンターまたはボタン）'}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="form-input"
            style={{ flex: 1, marginBottom: 0 }}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="btn"
            style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer' }}
            disabled={submitting}
          >
            {isEn ? 'Add' : '追加'}
          </button>
        </div>

        {/* 設定中のタグ一覧 */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {tags.map(t => (
              <span key={t} style={{ fontSize: '11px', background: 'var(--primary-color)', color: '#fff', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', padding: 0, display: 'flex', alignItems: 'center' }}
                  disabled={submitting}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {/* プリセットタグの推奨 */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{isEn ? 'Recommended tags for business:' : 'ビジネス用推奨タグ:'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(isEn ? ['Work', 'Meeting', 'Urgent', 'Research', 'Dev', 'Support'] : ['仕事', '会議', '緊急', '調査', '開発', 'サポート']).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleQuickAddTag(t)}
                  style={{ fontSize: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                  disabled={submitting || tags.includes(t)}
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{isEn ? 'Recommended tags for personal:' : '家庭・個人用推奨タグ:'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(isEn ? ['Chores', 'Shopping', 'Schedule', 'School', 'Lesson', 'Private'] : ['家事', '買い物', '予定', '学校', '習い事', 'プライベート']).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleQuickAddTag(t)}
                  style={{ fontSize: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                  disabled={submitting || tags.includes(t)}
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 日時指定（カレンダー登録トグル） */}
      <div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '13px', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={hasDateTime}
            onChange={(e) => setHasDateTime(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
            disabled={submitting}
          />
          <span>{isEn ? 'Set date/time to register in calendar' : '日時を設定してカレンダーに登録する'}</span>
        </label>
      </div>

      {hasDateTime && (
        <>
          {/* 終日チェック */}
          <div style={{ paddingLeft: '24px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '12px', color: 'var(--text-muted)', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => handleAllDayChange(e.target.checked)}
                style={{ width: '14px', height: '14px', accentColor: 'var(--primary-color)' }}
                disabled={submitting}
              />
              <span>{isEn ? 'All-day event' : '終日の予定にする'}</span>
            </label>
          </div>

          {/* 開始・終了日時 */}
          <div className="modal-datetime-row" style={{ display: 'flex', gap: '12px', paddingLeft: '24px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '12px' }}>{isEn ? (isAllDay ? 'Start Date' : 'Start Time') : `開始${isAllDay ? '日' : '日時'}`} <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="form-input"
                style={{
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  border: '1px solid var(--border-light)'
                }}
                required={hasDateTime}
                disabled={submitting}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '12px' }}>{isEn ? (isAllDay ? 'End Date' : 'End Time') : `終了${isAllDay ? '日' : '日時'}`} <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type={isAllDay ? 'date' : 'datetime-local'}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="form-input"
                style={{
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  border: '1px solid var(--border-light)'
                }}
                required={hasDateTime}
                disabled={submitting}
              />
            </div>
          </div>
        </>
      )}

      {/* 複数関連チャンネル */}
      <div className="form-group">
        <label className="form-label">{isEn ? 'Related Channels (Multiple selections allowed)' : '関連チャンネル（複数選択可能）'}</label>
        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {channels.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isEn ? 'No channels' : 'チャンネルはありません'}</span>
          ) : (
            channels.map(c => {
              let prefix = c.isPrivate ? '🔒 ' : '# ';
              if (c.type === 'dm') prefix = '💬 ';
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={channelIds.includes(c.id)}
                    onChange={() => toggleChannel(c.id)}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--primary-color)' }}
                    disabled={submitting}
                  />
                  <span>{prefix}{c.name}</span>
                </label>
              );
            })
          )}
        </div>
        <span className="form-help">
          {isEn ? 'If linked, creation/completion notifications will be posted to all selected channels for public items.' : 'チャンネルを紐付けると、公開アイテムの場合に作成/完了時の通知が選択したすべてのチャンネルへ投稿されます。'}
        </span>
      </div>

      {/* プラベート設定 */}
      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
            disabled={submitting}
          />
          <Lock size={14} style={{ opacity: 0.7 }} />
          <span>{isEn ? 'Make Private' : 'プライベート（非公開）にする'}</span>
        </label>
        <span className="form-help" style={{ paddingLeft: '24px' }}>
          {isEn ? 'If private, only the creator and assignees can view or edit it. No channel notifications will be sent.' : '非公開にすると、作成者とアサインされた担当者のみが閲覧・変更できます。チャンネルへの通知も行われません。'}
        </span>
      </div>
    </ModalBase>
  );
};
