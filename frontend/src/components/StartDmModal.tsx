import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface Member {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

interface StartDmModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string | null;
  currentUserId: string;
  onCreateDm: (memberIds: string[], name: string) => Promise<void>;
}

export const StartDmModal: React.FC<StartDmModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  currentUserId,
  onCreateDm,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    const loadMembers = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: Member[] }>(
          `/api/workspaces/${workspaceId}/members`
        );
        if (res.success && Array.isArray(res.data)) {
          // 自分自身およびゲストロールを除外して表示
          const others = res.data.filter((m) => m.userId !== currentUserId && m.role !== 'guest');
          setMembers(others);
        }
      } catch (err) {
        console.error('Failed to load workspace members for DM:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
    setSelectedIds([]);
    setSearchQuery('');
  }, [isOpen, workspaceId, currentUserId]);

  if (!isOpen) return null;

  const filteredMembers = members.filter(
    (m) =>
      m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      // 招待した相手 + 自分自身のID
      const allMemberIds = [...selectedIds, currentUserId];

      // DMのデフォルト名を決定（例: ユーザーA, ユーザーB）
      const selectedNames = members
        .filter((m) => selectedIds.includes(m.userId))
        .map((m) => m.displayName);
      const dmName = selectedNames.join(', ');

      await onCreateDm(allMemberIds, dmName);
      onClose();
    } catch (err: any) {
      alert((isEn ? 'Failed to start DM: ' : 'DMの開始に失敗しました: ') + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
        <div className="modal-header">
          <h2>{isEn ? 'Start Direct Message' : 'ダイレクトメッセージを開始'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 検索入力 */}
          <div className="search-input-wrapper" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={isEn ? 'Search members...' : 'メンバーを検索...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>

          {/* メンバー一覧 */}
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isEn ? 'Loading...' : '読み込み中...'}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isEn ? 'No members found.' : 'メンバーが見つかりませんでした。'}
            </div>
          ) : (
            <div 
              className="custom-scrollbar" 
              style={{ 
                maxHeight: '260px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                paddingRight: '4px'
              }}
            >
              {filteredMembers.map((member) => {
                const isChecked = selectedIds.includes(member.userId);
                return (
                  <div
                    key={member.userId}
                    onClick={() => toggleSelect(member.userId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isChecked ? '1px solid var(--primary-color)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '14px', overflow: 'hidden', flexShrink: 0 }}>
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl.startsWith('http') ? member.avatarUrl : `http://127.0.0.1:8787${member.avatarUrl}`}
                            alt={member.displayName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          member.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{member.displayName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.email}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // 親divのonClickで制御
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: 'var(--accent-primary)',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-light)' }}>
          <button className="close-btn" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.05)' }}>
            {isEn ? 'Cancel' : 'キャンセル'}
          </button>
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || submitting}
            style={{ 
              padding: '8px 16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              alignSelf: 'unset'
            }}
          >
            <UserPlus size={16} />
            <span>{submitting ? (isEn ? 'Starting...' : '開始中...') : (isEn ? 'Start DM' : 'DMを開始')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
