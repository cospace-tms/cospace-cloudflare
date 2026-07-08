import React, { useState, useEffect } from 'react';
import { Plus, Users, Shield, Trash2, UserMinus, Edit, Lock } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface Group {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
}

interface GroupMember {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isLeader: boolean;
}

interface WorkspaceMember {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'owner' | 'group_admin' | 'member' | 'guest';
}

interface WorkspaceGroupsTabProps {
  workspaceId: string;
  workspaceMembers: WorkspaceMember[];
  currentUserRole: 'owner' | 'group_admin' | 'guest' | 'member';
  currentUserLedGroups: string[];
}

export const WorkspaceGroupsTab: React.FC<WorkspaceGroupsTabProps> = ({
  workspaceId,
  workspaceMembers,
  currentUserRole,
  currentUserLedGroups,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [isLeaderToAdd, setIsLeaderToAdd] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [editingIsPrivateVal, setEditingIsPrivateVal] = useState(false);

  const isOwner = currentUserRole === 'owner';
  const isLeaderOfActiveGroup = currentUserRole === 'group_admin' && activeGroup && currentUserLedGroups.includes(activeGroup.id);
  const canEditGroup = isOwner || isLeaderOfActiveGroup;

  // グループ一覧の取得
  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: Group[] }>(
        `/api/workspaces/${workspaceId}/groups`
      );
      if (res.success && Array.isArray(res.data)) {
        setGroups(res.data);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // アクティブグループ所属メンバーの取得
  const loadGroupMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: GroupMember[] }>(
        `/api/groups/${groupId}/members`
      );
      if (res.success && Array.isArray(res.data)) {
        setGroupMembers(res.data);
      }
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadGroups();
    setActiveGroup(null);
    setGroupMembers([]);
  }, [workspaceId]);

  useEffect(() => {
    if (activeGroup) {
      loadGroupMembers(activeGroup.id);
    }
    setIsEditingName(false);
  }, [activeGroup]);

  // グループ作成
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: Group }>(
        `/api/workspaces/${workspaceId}/groups`,
        { name: newGroupName.trim(), workspaceId, isPrivate: newGroupIsPrivate }
      );
      if (res.success && res.data) {
        setGroups(prev => [...prev, res.data]);
        setNewGroupName('');
        setNewGroupIsPrivate(false);
        setActiveGroup(res.data);
      }
    } catch (err: any) {
      alert((isEn ? 'Failed to create group: ' : 'グループの作成に失敗しました: ') + (err.message || err));
    } finally {
      setAddingGroup(false);
    }
  };

  // グループ削除
  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!isOwner) return;
    const confirmMsg = isEn 
      ? `Are you sure you want to delete group "${name}"?\nMembers assigned to this group will be unassigned.`
      : `本当にグループ「${name}」を削除しますか？\n所属するメンバーのアサインや、グループ設定は解除されます。`;
    if (confirm(confirmMsg)) {
      try {
        const res = await apiClient.delete<{ success: boolean }>(`/api/groups/${groupId}`);
        if (res.success) {
          setGroups(prev => prev.filter(g => g.id !== groupId));
          if (activeGroup?.id === groupId) {
            setActiveGroup(null);
            setGroupMembers([]);
          }
        }
      } catch (err: any) {
        alert((isEn ? 'Failed to delete group: ' : 'グループの削除に失敗しました: ') + (err.message || err));
      }
    }
  };

  // グループ名およびプライベート設定の変更
  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !editingNameVal.trim() || !canEditGroup) return;
    try {
      const res = await apiClient.put<{ success: boolean; data: Group }>(
        `/api/groups/${activeGroup.id}`,
        { name: editingNameVal.trim(), isPrivate: editingIsPrivateVal }
      );
      if (res.success) {
        setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, name: editingNameVal.trim(), isPrivate: editingIsPrivateVal } : g));
        setActiveGroup(prev => prev ? { ...prev, name: editingNameVal.trim(), isPrivate: editingIsPrivateVal } : null);
        setIsEditingName(false);
      }
    } catch (err: any) {
      alert((isEn ? 'Failed to update group: ' : 'グループの更新に失敗しました: ') + (err.message || err));
    }
  };

  // グループへメンバー追加
  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !selectedMemberToAdd) return;
    setAddingMember(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: GroupMember }>(
        `/api/groups/${activeGroup.id}/members`,
        { userId: selectedMemberToAdd, isLeader: isLeaderToAdd }
      );
      if (res.success && res.data) {
        setGroupMembers(prev => [...prev, res.data]);
        setSelectedMemberToAdd('');
        setIsLeaderToAdd(false);
        setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, memberCount: g.memberCount + 1 } : g));

        // ワークスペース側ロールを自動的に同期
        const wsMember = workspaceMembers.find(m => m.userId === selectedMemberToAdd);
        if (wsMember) {
          const newRole = isLeaderToAdd ? 'group_admin' : 'member';
          if (wsMember.role !== 'owner' && wsMember.role !== newRole) {
            await apiClient.put(`/api/workspaces/${workspaceId}/members/${selectedMemberToAdd}`, { role: newRole });
          }
        }
      }
    } catch (err: any) {
      alert((isEn ? 'Failed to add member to group: ' : 'グループメンバーの追加に失敗しました: ') + (err.message || err));
    } finally {
      setAddingMember(false);
    }
  };

  // リーダー権限（グループ管理者）トグル
  const handleToggleLeader = async (member: GroupMember) => {
    if (!isOwner) return;
    const nextVal = !member.isLeader;
    try {
      const res = await apiClient.put<{ success: boolean }>(
        `/api/groups/${activeGroup!.id}/members/${member.userId}`,
        { isLeader: nextVal }
      );
      if (res.success) {
        setGroupMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, isLeader: nextVal } : m));
        
        // リーダー権限ONに同期してワークスペース上のロールを 'group_admin' / 'member' に変更
        const wsMember = workspaceMembers.find(m => m.userId === member.userId);
        if (wsMember) {
          const newRole = nextVal ? 'group_admin' : 'member';
          if (wsMember.role !== 'owner' && wsMember.role !== newRole) {
            await apiClient.put(`/api/workspaces/${workspaceId}/members/${member.userId}`, { role: newRole });
          }
        }
      }
    } catch (err: any) {
      alert((isEn ? 'Failed to toggle leader role: ' : 'リーダー権限の変更に失敗しました: ') + (err.message || err));
    }
  };

  // メンバーをグループから除外
  const handleDeleteMemberFromGroup = async (userId: string) => {
    if (!activeGroup) return;
    const confirmMsg = isEn 
      ? 'Are you sure you want to remove this member from the group?' 
      : 'このメンバーをグループから除外しますか？';
    if (confirm(confirmMsg)) {
      try {
        const res = await apiClient.delete<{ success: boolean }>(
          `/api/groups/${activeGroup.id}/members/${userId}`
        );
        if (res.success) {
          setGroupMembers(prev => prev.filter(m => m.userId !== userId));
          setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, memberCount: g.memberCount - 1 } : g));
        }
      } catch (err: any) {
        alert((isEn ? 'Failed to remove group member: ' : 'グループメンバーの削除に失敗しました: ') + (err.message || err));
      }
    }
  };

  // まだグループに所属していないワークスペースメンバー
  const availableMembers = workspaceMembers.filter(wm => 
    !groupMembers.some(gm => gm.userId === wm.userId)
  );

  return (
    <div className="workspace-groups-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: '380px' }}>
      {/* 左ペイン: グループ一覧とグループ作成 */}
      <div className="workspace-groups-left-pane" style={{ borderRight: '1px solid var(--border-light)', paddingRight: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>{isEn ? 'Groups' : 'グループ一覧'}</h4>
        
        {isOwner && (
          <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={newGroupName} 
                onChange={(e) => setNewGroupName(e.target.value)} 
                placeholder={isEn ? 'New Group Name' : '新しいグループ名'}
                required 
                className="form-input" 
                style={{ padding: '8px 12px', fontSize: '13px', flex: 1 }}
                disabled={addingGroup}
              />
              <button type="submit" className="submit-btn" style={{ padding: '8px 12px', fontSize: '13px', flexShrink: 0 }} disabled={addingGroup}>
                <Plus size={14} />
                <span>{isEn ? 'Create' : '作成'}</span>
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newGroupIsPrivate}
                onChange={(e) => setNewGroupIsPrivate(e.target.checked)}
                disabled={addingGroup}
                style={{ accentColor: 'var(--primary-color)' }}
              />
              <span>{isEn ? 'Make Private Group' : 'プライベートグループにする'}</span>
            </label>
          </form>
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {loadingGroups ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isEn ? 'Loading...' : '読み込み中...'}</p>
          ) : groups.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>{isEn ? 'No groups.' : 'グループがありません。'}</p>
          ) : (
            groups.map((group) => {
              const isActive = activeGroup?.id === group.id;
              return (
                <div 
                  key={group.id}
                  onClick={() => setActiveGroup(group)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '8px 12px', 
                    background: isActive ? 'var(--bg-active)' : 'var(--bg-secondary)', 
                    border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {group.isPrivate ? (
                      <Lock size={15} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                    ) : (
                      <Users size={16} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500 }}>{group.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--border-light)', padding: '2px 6px', borderRadius: '10px' }}>
                      {isEn ? (group.memberCount === 1 ? '1 member' : `${group.memberCount} members`) : `${group.memberCount}名`}
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id, group.name);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                      title={isEn ? 'Delete Group' : 'グループを削除'}
                    >
                      <Trash2 size={13} style={{ transition: 'color 0.15s' }} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 右ペイン: 選択したグループのメンバー管理 */}
      <div className="workspace-groups-right-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {activeGroup ? (
          <>
            {isEditingName ? (
              <form onSubmit={handleRenameGroup} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editingNameVal}
                    onChange={(e) => setEditingNameVal(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '13px', flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    required
                  />
                  <button type="submit" className="submit-btn" style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}>{isEn ? 'Save' : '保存'}</button>
                  <button type="button" className="btn-secondary" onClick={() => setIsEditingName(false)} style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}>{isEn ? 'Cancel' : 'キャンセル'}</button>
                </div>
                {canEditGroup && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingIsPrivateVal}
                      onChange={(e) => setEditingIsPrivateVal(e.target.checked)}
                      style={{ accentColor: 'var(--primary-color)' }}
                    />
                    <span>{isEn ? 'Make Private Group' : 'プライベートグループにする'}</span>
                  </label>
                )}
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isEn ? `Members of "${activeGroup.name}"` : `「${activeGroup.name}」のメンバー管理`}
                  </h4>
                  {canEditGroup && (
                    <button 
                      onClick={() => {
                        setEditingNameVal(activeGroup.name);
                        setEditingIsPrivateVal(activeGroup.isPrivate);
                        setIsEditingName(true);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      title={isEn ? 'Rename Group' : 'グループ名変更'}
                    >
                      <Edit size={13} />
                    </button>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--border-light)', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {activeGroup.isPrivate ? (
                      <>
                        <Lock size={12} style={{ color: 'var(--accent-warning)' }} />
                        <span>{isEn ? 'Private Group' : 'プライベートグループ'}</span>
                      </>
                    ) : (
                      <>
                        <Users size={12} />
                        <span>{isEn ? 'Public Group' : '公開グループ'}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* メンバー追加フォーム */}
            {isOwner && (
              <form onSubmit={handleAddMemberToGroup} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <select
                  value={selectedMemberToAdd}
                  onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                  className="form-input"
                  style={{ padding: '8px 12px', fontSize: '13px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                  required
                  disabled={addingMember}
                >
                  <option value="">{isEn ? 'Select Member' : 'メンバーを選択'}</option>
                  {availableMembers.map(m => (
                    <option key={m.userId} value={m.userId}>{m.displayName} ({m.email})</option>
                  ))}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input 
                    type="checkbox" 
                    checked={isLeaderToAdd} 
                    onChange={(e) => setIsLeaderToAdd(e.target.checked)} 
                    disabled={addingMember}
                  />
                  <span>{isEn ? 'Make Admin' : '管理者にする'}</span>
                </label>
                <button type="submit" className="submit-btn" style={{ padding: '8px 12px', fontSize: '13px' }} disabled={addingMember}>
                  {isEn ? 'Add' : '追加'}
                </button>
              </form>
            )}

            {/* メンバーリスト */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loadingMembers ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isEn ? 'Loading...' : '読み込み中...'}</p>
              ) : groupMembers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>{isEn ? 'No members in this group.' : 'メンバーが所属していません。'}</p>
              ) : (
                groupMembers.map((member) => (
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* リーダー権限トグル */}
                      {isOwner ? (
                        <button
                          onClick={() => handleToggleLeader(member)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: member.isLeader ? 'var(--accent-warning)' : 'var(--text-disabled)', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          title={isEn ? (member.isLeader ? 'Remove admin role' : 'Make group admin') : (member.isLeader ? '管理者権限を解除' : '管理者権限に指定')}
                        >
                          <Shield size={14} />
                          <span>{member.isLeader ? (isEn ? 'Group Admin' : 'グループ管理者') : (isEn ? 'Member' : '一般')}</span>
                        </button>
                      ) : (
                        member.isLeader && (
                          <span style={{ fontSize: '11px', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Shield size={12} />
                            <span>{isEn ? 'Group Admin' : 'グループ管理者'}</span>
                          </span>
                        )
                      )}

                      {/* 除外ボタン */}
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteMemberFromGroup(member.userId)}
                          className="danger-btn"
                          style={{ padding: '4px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: 'none', display: 'flex' }}
                          title={isEn ? 'Remove from Group' : 'グループから除外'}
                        >
                          <UserMinus size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {isEn ? 'Select a group from the left pane.' : '左ペインからグループを選択してください。'}
          </div>
        )}
      </div>
    </div>
  );
};
