import React, { useState, useEffect } from 'react';
import { X, Search, Globe, Lock, ArrowRight, Settings } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  type?: string;
  groupId?: string | null;
}

interface BrowseChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string | null;
  currentUserRole: 'owner' | 'group_admin' | 'member' | 'guest';
  currentUserLedGroups: string[];
  onJoinChannel: (channelId: string) => Promise<void>;
  onOpenChannelSettings: (channel: Channel) => void;
}

export const BrowseChannelsModal: React.FC<BrowseChannelsModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  currentUserRole,
  currentUserLedGroups,
  onJoinChannel,
  onOpenChannelSettings,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [channels, setChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    const loadBrowseChannels = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: Channel[] }>(
          `/api/workspaces/${workspaceId}/browse-channels`
        );
        if (res.success && Array.isArray(res.data)) {
          setChannels(res.data);
        }
      } catch (err) {
        console.error('Failed to load browse channels:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBrowseChannels();
    setSearchQuery('');
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const filteredChannels = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleJoin = async (channelId: string) => {
    setJoiningId(channelId);
    try {
      await onJoinChannel(channelId);
      onClose();
    } catch (err: any) {
      alert((isEn ? 'Failed to join channel: ' : 'チャンネルの参加に失敗しました: ') + (err.message || err));
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
        <div className="modal-header">
          <h2>{isEn ? 'Browse Channels' : 'チャンネルをブラウズ'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 検索入力 */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={isEn ? 'Search by channel name or description...' : 'チャンネル名や説明で検索...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>

          {/* チャンネル一覧 */}
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isEn ? 'Loading...' : '読み込み中...'}
            </div>
          ) : filteredChannels.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {searchQuery 
                ? (isEn ? 'No matching channels found.' : '一致するチャンネルが見つかりませんでした。') 
                : (isEn ? 'No new channels available to join.' : '参加可能な新しいチャンネルはありません。')}
            </div>
          ) : (
            <div 
              className="custom-scrollbar" 
              style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                paddingRight: '4px'
              }}
            >
              {filteredChannels.map((channel) => {
                const isOwner = currentUserRole === 'owner';
                const isGroupLeader = channel.groupId && currentUserLedGroups.includes(channel.groupId);
                const canManageChannel = isOwner || isGroupLeader;

                return (
                  <div
                    key={channel.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      {channel.isPrivate ? (
                        <Lock size={16} style={{ color: 'var(--accent-warning)', flexShrink: 0 }} />
                      ) : (
                        <Globe size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {channel.name}
                        </span>
                        {channel.description && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {channel.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {canManageChannel && (
                        <button
                          onClick={() => {
                            onOpenChannelSettings(channel);
                            onClose();
                          }}
                          className="close-btn"
                          style={{ padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                          title={isEn ? 'Channel Settings' : '設定を変更'}
                        >
                          <Settings size={14} />
                        </button>
                      )}
                      <button
                        className="submit-btn"
                        onClick={() => handleJoin(channel.id)}
                        disabled={joiningId !== null}
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '12px',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          alignSelf: 'unset'
                        }}
                      >
                        <span>{joiningId === channel.id ? (isEn ? 'Joining...' : '参加中...') : (isEn ? 'Join' : '参加')}</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
