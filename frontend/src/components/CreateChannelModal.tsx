import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface Group {
  id: string;
  name: string;
}

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string | null;
  onCreateChannel: (name: string, description: string, isPrivate: boolean, groupId?: string) => Promise<void>;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  onCreateChannel,
}) => {
  const { t } = useLanguage();
  const [channelName, setChannelName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    const loadGroups = async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: Group[] }>(
          `/api/workspaces/${workspaceId}/groups`
        );
        if (res.success && Array.isArray(res.data)) {
          setGroups(res.data);
        }
      } catch (err) {
        console.error('Failed to load groups for channel creation modal:', err);
      }
    };

    loadGroups();
    setChannelName('');
    setDescription('');
    setIsPrivate(false);
    setSelectedGroupId('');
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateChannel(
        channelName.trim(),
        description.trim(),
        isPrivate,
        selectedGroupId || undefined
      );
      onClose();
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to create channel: ' : 'チャンネルの作成に失敗しました: ') + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" style={{ maxWidth: '480px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('error') === 'Error' ? 'Create New Channel' : '新規チャンネルを作成'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="settings-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">{t('error') === 'Error' ? 'Channel Name' : 'チャンネル名'}</label>
              <input
                type="text"
                placeholder={t('error') === 'Error' ? "e.g., project-x" : "例: project-x"}
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="form-input"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('error') === 'Error' ? 'Description (optional)' : '説明（省略可能）'}</label>
              <textarea
                placeholder={t('error') === 'Error' ? "Enter the purpose of this channel, etc." : "チャンネルの目的などを入力してください"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-textarea"
                style={{ minHeight: '80px' }}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('error') === 'Error' ? 'Link to a specific group (optional)' : '特定のグループに紐付ける（省略可能）'}</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="form-input"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--border-light)' }}
                disabled={submitting}
              >
                <option value="">{t('error') === 'Error' ? 'No link to group (Public)' : 'グループに紐付けない（全体公開）'}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <span className="form-help">
                {t('error') === 'Error' 
                  ? 'Linking to a group restricts this channel to only members of that group.' 
                  : 'グループに紐付けると、そのグループのメンバーだけが参加できるチャンネルになります。'}
              </span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                  disabled={submitting}
                />
                <span>{t('error') === 'Error' ? 'Make Private Channel' : 'プライベートチャンネルにする'}</span>
              </label>
              <span className="form-help">
                {t('error') === 'Error' 
                  ? 'Private channels can only be viewed by invited members or group leaders.' 
                  : 'プライベートにすると、招待されたメンバーまたはグループリーダーのみが閲覧できます。'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-light)' }}>
            <button type="button" className="close-btn" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.05)' }} disabled={submitting}>
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="submit-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'unset' }}
              disabled={submitting || !channelName.trim()}
            >
              <Plus size={16} />
              <span>{submitting ? (t('error') === 'Error' ? 'Creating...' : '作成中...') : (t('error') === 'Error' ? 'Create' : '作成する')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
