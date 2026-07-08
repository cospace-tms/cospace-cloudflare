import React, { useState, useEffect } from 'react';
import { X, Trash2, UserMinus, Plus } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface WorkspaceMember {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: {
    id: string;
    name: string;
    description?: string;
    isPrivate: boolean;
    type?: string;
    groupId?: string | null;
  } | null;
  currentUserRole: 'owner' | 'group_admin' | 'member' | 'guest';
  currentUserLedGroups: string[];
  currentUserId: string;
  workspaceMembers: WorkspaceMember[];
  onUpdateChannel: (name: string, description: string, isPrivate: boolean) => Promise<void>;
  onDeleteChannel: () => Promise<void>;
  onLeaveChannel: () => Promise<void>;
  isJoined: boolean;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
  isOpen,
  onClose,
  channel,
  currentUserRole,
  currentUserLedGroups,
  currentUserId,
  workspaceMembers,
  onUpdateChannel,
  onDeleteChannel,
  onLeaveChannel,
  isJoined,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [channelName, setChannelName] = useState(channel?.name || '');
  const [channelDescription, setChannelDescription] = useState(channel?.description || '');
  const [isPrivate, setIsPrivate] = useState(channel?.isPrivate || false);

  // チャンネルメンバー管理ステート
  const [channelMembers, setChannelMembers] = useState<WorkspaceMember[]>([]);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const isGeneral = channel?.name === 'general' && channel?.type !== 'dm';

  const handleLeaveClick = async () => {
    const isDm = channel?.type === 'dm';
    const msg = isDm 
      ? (isEn ? 'Are you sure you want to leave this direct message?' : '本当にこのダイレクトメッセージから退出しますか？')
      : (isEn ? `Are you sure you want to leave the channel "#${channel?.name}"?\nTo join again, you will need to re-enter from the channel browser.` : `本当にチャンネル「#${channel?.name}」から退出しますか？\n再度参加するには、チャンネルブラウザから入り直す必要があります。`);

    if (confirm(msg)) {
      try {
        await onLeaveChannel();
        alert(isDm ? (isEn ? 'Left DM.' : 'DMから退出しました。') : (isEn ? 'Left channel.' : 'チャンネルから退出しました。'));
        onClose();
      } catch (err: any) {
        alert((isEn ? 'Failed to leave: ' : '退出に失敗しました: ') + (err.message || err));
      }
    }
  };

  const loadChannelMembers = async () => {
    if (!channel) return;
    setLoadingMembers(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: WorkspaceMember[] }>(
        `/api/channels/${channel.id}/members`
      );
      if (res.success && Array.isArray(res.data)) {
        setChannelMembers(res.data);
      }
    } catch (err) {
      console.error('Failed to load channel members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (isOpen && channel) {
      setChannelName(channel.name);
      setChannelDescription(channel.description || '');
      setIsPrivate(channel.isPrivate);
      
      // プライベートまたはDMの場合のみメンバーロード
      if (channel.isPrivate || channel.type === 'dm') {
        loadChannelMembers();
      } else {
        setChannelMembers([]);
      }
    }
    setSelectedMemberToAdd('');
  }, [isOpen, channel]);

  if (!isOpen || !channel) return null;

  const isOwner = currentUserRole === 'owner';
  const isGroupLeader = channel.groupId && currentUserLedGroups.includes(channel.groupId);
  const isDmMember = channel.type === 'dm' && channelMembers.some(m => m.userId === currentUserId);
  const canManageMembers = isOwner || isGroupLeader || isDmMember;
  const canTogglePrivacy = isOwner || (currentUserRole === 'group_admin' && !!channel.groupId && currentUserLedGroups.includes(channel.groupId));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateChannel(channelName, channelDescription, isPrivate);
      alert(isEn ? 'Channel settings updated.' : 'チャンネル設定を更新しました。');
      onClose();
    } catch (err: any) {
      alert((isEn ? 'Failed to update channel: ' : 'チャンネルの更新に失敗しました: ') + (err.message || err));
    }
  };

  const handleDeleteClick = async () => {
    const isDm = channel.type === 'dm';
    const confirmMsg = isDm 
      ? (isEn ? 'Are you sure you want to delete this direct message history?\nThis action cannot be undone.' : '本当にこのダイレクトメッセージ履歴を削除しますか？\nこの操作は取り消せません。')
      : (isEn ? `Are you sure you want to delete the channel "#${channel.name}"?\nThis action cannot be undone.` : `本当にチャンネル「#${channel.name}」を削除しますか？\nこの操作は取り消せません。`);

    if (confirm(confirmMsg)) {
      try {
        await onDeleteChannel();
        alert(isEn ? 'Channel deleted.' : 'チャンネルを削除しました。');
        onClose();
      } catch (err: any) {
        alert((isEn ? 'Failed to delete channel: ' : 'チャンネルの削除に失敗しました: ') + (err.message || err));
      }
    }
  };

  // メンバー追加処理
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberToAdd) return;
    setAddingMember(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: WorkspaceMember }>(
        `/api/channels/${channel.id}/members`,
        { userId: selectedMemberToAdd }
      );
      if (res.success && res.data) {
        setChannelMembers(prev => [...prev, res.data]);
        setSelectedMemberToAdd('');
      }
    } catch (err: any) {
      alert((isEn ? 'Failed to add member: ' : 'メンバーの追加に失敗しました: ') + (err.message || err));
    } finally {
      setAddingMember(false);
    }
  };

  // メンバー除外処理
  const handleDeleteMember = async (targetUserId: string) => {
    if (confirm(isEn ? 'Remove this member from the channel?' : 'このメンバーをチャンネルから除外しますか？')) {
      try {
        const res = await apiClient.delete<{ success: boolean }>(
          `/api/channels/${channel.id}/members/${targetUserId}`
        );
        if (res.success) {
          setChannelMembers(prev => prev.filter(m => m.userId !== targetUserId));
        }
      } catch (err: any) {
        alert((isEn ? 'Failed to remove member: ' : 'メンバーの除外に失敗しました: ') + (err.message || err));
      }
    }
  };

  // 招待候補メンバー（まだチャンネルにいないメンバー、自分自身も既にロードされている場合は除外）
  const availableMembers = workspaceMembers.filter(wm => 
    !channelMembers.some(cm => cm.userId === wm.userId)
  );

  const getDmDisplayName = (dmName: string): string => {
    const names = dmName.split(',').map((n) => n.trim());
    const filtered = names.filter((n) => n !== workspaceMembers.find(m => m.userId === currentUserId)?.displayName);
    if (filtered.length === 0) return dmName;
    return filtered.join(', ');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" style={{ maxWidth: '820px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <style>{`
          .channel-settings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            max-height: 480px;
            overflow-y: auto;
          }
          .basic-info-pane {
            grid-column: 1;
            grid-row: 1;
          }
          .danger-zone-pane {
            grid-column: 1;
            grid-row: 2;
            margin-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .member-pane {
            grid-column: 2;
            grid-row: 1 / span 2;
            display: flex;
            flex-direction: column;
            height: 100%;
            border-left: 1px solid var(--border-light);
            padding-left: 24px;
          }
          @media (max-width: 768px) {
            .channel-settings-grid {
              display: flex;
              flex-direction: column;
              gap: 20px;
              max-height: 70vh;
            }
            .basic-info-pane {
              order: 1;
            }
            .member-pane {
              order: 2;
              border-left: none;
              padding-left: 0;
              border-top: 1px solid var(--border-light);
              padding-top: 20px;
            }
            .danger-zone-pane {
              order: 3;
              border-top: 1px solid var(--border-light);
              padding-top: 20px;
              margin-top: 0;
            }
          }
        `}</style>
        <div className="modal-header">
          <h2>{channel.type === 'dm' ? (isEn ? `DM: Settings for ${getDmDisplayName(channel.name)}` : `DM: ${getDmDisplayName(channel.name)} の設定`) : (isEn ? `Channel Settings: #${channel.name}` : `チャンネル設定: #${channel.name}`)}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body channel-settings-grid">
          {/* 左ペイン: 基本情報設定 */}
          <div className="basic-info-pane settings-form-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <form onSubmit={handleSave} className="settings-form">
              {channel.type !== 'dm' && (
                <div className="form-group">
                  <label>{isEn ? 'Channel Name' : 'チャンネル名'}</label>
                  <input 
                    type="text" 
                    value={channelName} 
                    onChange={(e) => setChannelName(e.target.value)} 
                    required 
                    className="form-input" 
                  />
                </div>
              )}
              <div className="form-group">
                <label>{isEn ? 'Description' : '説明'}</label>
                <textarea 
                  value={channelDescription} 
                  onChange={(e) => setChannelDescription(e.target.value)} 
                  className="form-textarea" 
                  placeholder={channel.type === 'dm' ? (isEn ? 'DM description' : 'DMの説明') : (isEn ? 'Enter the purpose of this channel, etc.' : 'チャンネルの目的などを入力してください')}
                  style={{ minHeight: '80px' }}
                />
              </div>

              {channel.type !== 'dm' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canTogglePrivacy ? 'pointer' : 'default', fontWeight: '500' }}>
                    <input 
                      type="checkbox" 
                      checked={isPrivate} 
                      disabled={!canTogglePrivacy}
                      onChange={(e) => setIsPrivate(e.target.checked)} 
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                    />
                    <span>{isEn ? 'Make this channel private' : 'このチャンネルをプライベートにする'}</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {isEn ? 'Private channels can only be viewed by assigned members or group leaders.' : 'プライベートチャンネルは、アサインされたメンバーまたはグループリーダーのみが閲覧できます。'}
                  </span>
                </div>
              )}

              <button type="submit" className="submit-btn" style={{ marginTop: '8px' }}>{isEn ? 'Save' : '保存する'}</button>
            </form>
          </div>

          {/* 危険区域 */}
          <div className="danger-zone-pane danger-zone">
            <h3>{isEn ? 'Danger Zone' : '危険区域'}</h3>
            
            {/* 退出ボタン（general 以外 且つ 自身が参加済みの場合） */}
            {!isGeneral && isJoined && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p style={{ margin: 0 }}>{isEn ? 'Leave this chat and remove it from the sidebar.' : 'このチャットからの参加を解除し、サイドバーから取り除きます。'}</p>
                <button onClick={handleLeaveClick} type="button" className="danger-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', width: 'fit-content' }}>
                  <span>{channel.type === 'dm' ? (isEn ? 'Leave DM' : 'DMから退出する') : (isEn ? 'Leave Channel' : 'チャンネルから退出する')}</span>
                </button>
              </div>
            )}

            {/* 削除ボタン（owner 権限または、チャンネルグループリーダー） */}
            {(isOwner || isGroupLeader) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: !isGeneral && isJoined ? '1px solid rgba(255, 255, 255, 0.05)' : 'none', paddingTop: !isGeneral && isJoined ? '12px' : '0' }}>
                <p style={{ margin: 0 }}>{channel.type === 'dm' ? (isEn ? 'Delete direct message history.' : 'ダイレクトメッセージの履歴を削除します。') : (isEn ? 'Deleting the channel will permanently delete all message history.' : 'チャンネルを削除すると、すべてのメッセージ履歴が削除されます。')}</p>
                <button onClick={handleDeleteClick} type="button" className="danger-btn">
                  <Trash2 size={16} />
                  <span>{channel.type === 'dm' ? (isEn ? 'Delete DM' : 'DMを削除する') : (isEn ? 'Delete Channel' : 'チャンネルを削除する')}</span>
                </button>
              </div>
            )}
          </div>

          {/* 右ペイン: メンバー管理 */}
          <div className="member-pane">
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', marginTop: 0 }}>
              {isEn ? 'Manage Members' : '参加メンバー管理'}
            </h4>

            {(!isPrivate && channel.type !== 'dm') ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-light)', padding: '20px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                {isEn ? 'Since this channel is public, all workspace members join automatically.' : 'このチャンネルはパブリックであるため、ワークスペースのすべてのメンバーが自動的に参加します。'}
              </div>
            ) : (
              <>
                {/* メンバー追加フォーム */}
                {canManageMembers && (
                  <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <select
                      value={selectedMemberToAdd}
                      onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                      className="form-input"
                      style={{ padding: '8px 12px', fontSize: '13px', flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                      required
                      disabled={addingMember}
                    >
                      <option value="">{isEn ? 'Invite member' : 'メンバーを招待'}</option>
                      {availableMembers.map(m => (
                        <option key={m.userId} value={m.userId}>{m.displayName} ({m.email})</option>
                      ))}
                    </select>
                    <button type="submit" className="submit-btn" style={{ padding: '8px 12px', fontSize: '13px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }} disabled={addingMember}>
                      <Plus size={14} />
                      <span>{isEn ? 'Add' : '追加'}</span>
                    </button>
                  </form>
                )}

                {/* メンバーリスト */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px' }}>
                  {loadingMembers ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isEn ? 'Loading...' : '読み込み中...'}</p>
                  ) : channelMembers.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>{isEn ? 'No members are joined.' : '参加しているメンバーがいません。'}</p>
                  ) : (
                    channelMembers.map((member) => (
                      <div 
                        key={member.userId}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '6px 10px', 
                          background: 'var(--bg-secondary)', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: '6px' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="user-avatar" style={{ width: '26px', height: '26px', fontSize: '11px', overflow: 'hidden' }}>
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl.startsWith('http') ? member.avatarUrl : `http://127.0.0.1:8787${member.avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              member.displayName.substring(0, 1).toUpperCase()
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500 }}>{member.displayName}</span>
                          </div>
                        </div>

                        {canManageMembers && member.userId !== currentUserId && (
                          <button
                            onClick={() => handleDeleteMember(member.userId)}
                            className="danger-btn"
                            style={{ padding: '4px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: 'none', display: 'flex' }}
                            title={isEn ? 'Remove from channel' : 'チャンネルから除外'}
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
