import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Trash2, Users, Sliders, Plus, Menu, Mail, Key, Loader } from 'lucide-react';
import { WorkspaceGroupsTab } from './WorkspaceGroupsTab';
import { SmtpSettingsTab } from './SmtpSettingsTab';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface Member {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'owner' | 'group_admin' | 'member' | 'guest';
  groupIds?: string[];
}

interface WorkspaceMembersModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  workspace: {
    id: string;
    name: string;
    custom_statuses?: string;
  } | null;
  currentUserRole: 'owner' | 'group_admin' | 'member' | 'guest';
  currentUserLedGroups: string[];
  onUpdateWorkspace: (name: string, customStatuses?: string) => Promise<void>;
  onDeleteWorkspace: () => Promise<void>;
  isEmbed?: boolean;
  onMenuClick?: () => void;
}

export const WorkspaceMembersModal: React.FC<WorkspaceMembersModalProps> = ({
  isOpen,
  onClose,
  workspace,
  currentUserRole,
  currentUserLedGroups,
  onUpdateWorkspace,
  onDeleteWorkspace,
  isEmbed = false,
  onMenuClick,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'members' | 'groups' | 'statuses' | 'smtp'>('members');
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [newStatusName, setNewStatusName] = useState('');

  // 一時パスワード発行ステート
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resettingUser, setResettingUser] = useState<Member | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // 一般メンバー一時パスワードリセット処理
  const handleResetPassword = async (targetMember: Member) => {
    if (!workspace) return;
    const confirmMsg = t('error') === 'Error'
      ? `Are you sure you want to reset the password for "${targetMember.displayName}" and issue a temporary password?`
      : `本当にユーザー「${targetMember.displayName}」のパスワードをリセットし、一時パスワードを発行しますか？`;
    if (!confirm(confirmMsg)) return;

    setResetLoading(true);
    setTempPassword(null);
    setResettingUser(targetMember);

    try {
      const res = await apiClient.post<{ success: boolean; tempPassword: string }>(
        `/api/workspaces/${workspace.id}/members/${targetMember.userId}/reset-password`
      );
      if (res.success && res.tempPassword) {
        setTempPassword(res.tempPassword);
      }
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to reset password: ' : 'パスワードのリセットに失敗しました: ') + (err.message || err));
      setResettingUser(null);
    } finally {
      setResetLoading(false);
    }
  };

  // 新規メンバー招待ステート
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'group_admin' | 'member' | 'guest'>('member');
  const [addingMember, setAddingMember] = useState(false);

  const isOwner = currentUserRole === 'owner';
  const isGroupAdmin = currentUserRole === 'group_admin';
  const canAccessSettings = isOwner || isGroupAdmin;

  // メンバー一覧の取得
  const loadMembers = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: Member[] }>(
        `/api/workspaces/${workspace.id}/members`
      );
      if (res.success && Array.isArray(res.data)) {
        setMembers(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load workspace members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((isOpen || isEmbed) && workspace) {
      setWorkspaceName(workspace.name);
      const statuses = workspace.custom_statuses 
        ? workspace.custom_statuses.split(',').filter(Boolean)
        : ['todo', 'in_progress', 'done'];
      setCustomStatuses(statuses);
      loadMembers();
    }
  }, [isOpen, isEmbed, workspace]);

  if (!isEmbed && (!isOpen || !workspace)) return null;
  if (isEmbed && !workspace) return null;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateWorkspace(workspaceName);
      alert(t('error') === 'Error' ? 'Workspace name updated.' : 'ワークスペース名を更新しました。');
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to update workspace name: ' : 'ワークスペース名の更新に失敗しました: ') + (err.message || err));
    }
  };

  const handleSaveStatuses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customStatuses.length === 0) {
      alert(t('error') === 'Error' ? 'At least one status is required.' : '少なくとも1つのステータスが必要です。');
      return;
    }
    try {
      await onUpdateWorkspace(workspaceName, customStatuses.join(','));
      alert(t('error') === 'Error' ? 'Status settings updated.' : 'ステータス設定を更新しました。');
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to update statuses: ' : 'ステータスの更新に失敗しました: ') + (err.message || err));
    }
  };

  const handleAddStatus = () => {
    const trimmed = newStatusName.trim();
    if (!trimmed) return;
    if (customStatuses.includes(trimmed)) {
      alert(t('error') === 'Error' ? 'A status with the same name already exists.' : '同じ名前のステータスが既に存在します。');
      return;
    }
    setCustomStatuses([...customStatuses, trimmed]);
    setNewStatusName('');
  };

  const handleRemoveStatus = (statusToRemove: string) => {
    if (customStatuses.length <= 1) {
      alert(t('error') === 'Error' ? 'Cannot delete all statuses. At least one status is required.' : 'すべてのステータスを削除することはできません。最低1つのステータスが必要です。');
      return;
    }
    const confirmMsg = t('error') === 'Error'
      ? `Delete status "${statusToRemove}"?\n(Existing tasks with this status will remain unchanged)`
      : `ステータス「${statusToRemove}」を削除しますか？\n（このステータスが設定された既存タスクはそのまま残ります）`;
    if (confirm(confirmMsg)) {
      setCustomStatuses(customStatuses.filter(s => s !== statusToRemove));
    }
  };

  // メンバー追加
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspace) return;
    setAddingMember(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: Member }>(
        `/api/workspaces/${workspace.id}/members`,
        { email: inviteEmail.trim(), role: inviteRole }
      );
      if (res.success && res.data) {
        setMembers(prev => [...prev, res.data]);
        setInviteEmail('');
        alert(t('error') === 'Error' ? 'Member added. A temporary account has been created if the user is not registered.' : 'メンバーを追加しました。ユーザーが未登録の場合は仮アカウントが作成されました。');
      }
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to add member: ' : 'メンバーの追加に失敗しました: ') + (err.message || err));
    } finally {
      setAddingMember(false);
    }
  };

  // ロールの更新
  const handleRoleChange = async (userId: string, newRole: 'owner' | 'group_admin' | 'member' | 'guest') => {
    if (!workspace) return;
    try {
      const res = await apiClient.put<{ success: boolean }>(
        `/api/workspaces/${workspace.id}/members/${userId}`,
        { role: newRole }
      );
      if (res.success) {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
      }
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to change role: ' : 'ロールの変更に失敗しました: ') + (err.message || err));
    }
  };

  // メンバーの削除
  const handleDeleteMember = async (userId: string, memberName: string) => {
    if (!workspace) return;
    const confirmMsg = t('error') === 'Error'
      ? `Are you sure you want to remove "${memberName}" from the workspace?`
      : `本当に「${memberName}」をワークスペースから削除しますか？`;
    if (confirm(confirmMsg)) {
      try {
        const res = await apiClient.delete<{ success: boolean }>(
          `/api/workspaces/${workspace.id}/members/${userId}`
        );
        if (res.success) {
          setMembers(prev => prev.filter(m => m.userId !== userId));
        }
      } catch (err: any) {
        alert((t('error') === 'Error' ? 'Failed to remove member: ' : 'メンバーの削除に失敗しました: ') + (err.message || err));
      }
    }
  };

  const handleDeleteWorkspaceClick = async () => {
    if (!workspace) return;
    const confirmMsg = t('error') === 'Error'
      ? `Are you sure you want to delete the workspace "${workspace.name}"?\nThis action cannot be undone. All channels and messages will be permanently deleted.`
      : `本当にワークスペース「${workspace.name}」を削除しますか？\nこの操作は取り消せません。所属するすべてのチャンネルやメッセージが削除されます。`;
    if (confirm(confirmMsg)) {
      try {
        await onDeleteWorkspace();
        alert(t('error') === 'Error' ? 'Workspace deleted.' : 'ワークスペースを削除しました。');
        onClose?.();
      } catch (err: any) {
        alert((t('error') === 'Error' ? 'Failed to delete workspace: ' : 'ワークスペースの削除に失敗しました: ') + (err.message || err));
      }
    }
  };

  // 対象メンバーを編集（ロール変更・削除）可能か判定する関数
  const canModifyMember = (targetMember: Member): boolean => {
    // 自分自身は変更不可
    if (targetMember.userId === apiClient.getUserId()) return false;
    // ワークスペースオーナーは全員変更可能
    if (isOwner) return true;
    // グループ管理者の場合
    if (isGroupAdmin) {
      // 対象がオーナーの場合は変更不可
      if (targetMember.role === 'owner') return false;
      // 自分がリーダーを務めるグループのいずれかに対象メンバーが所属しているかチェック
      const memberGroupIds = targetMember.groupIds || [];
      const isSharedGroup = memberGroupIds.some(gid => currentUserLedGroups.includes(gid));
      return isSharedGroup;
    }
    return false;
  };

  const renderMembersTab = () => {
    return (
      <div className="settings-form-wrapper">
        {/* 1. ワークスペース名変更（管理者のみ） */}
        <div className="settings-section" style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{t('workspace.general')}</h3>
          <form onSubmit={handleUpdateName} className="settings-form" style={{ flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>{t('setup.workspaceName')}</label>
              <input 
                type="text" 
                value={workspaceName} 
                onChange={(e) => setWorkspaceName(e.target.value)} 
                required 
                className="form-input" 
                disabled={!isOwner}
              />
            </div>
            {isOwner && <button type="submit" className="submit-btn" style={{ padding: '11px 20px' }}>{t('workspace.rename')}</button>}
          </form>
        </div>

        {/* 2. 新規メンバー招待（オーナーのみ可能とする） */}
        {isOwner && (
          <div className="settings-section" style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{t('workspace.invite')}</h3>
            <form onSubmit={handleAddMember} className="settings-form" style={{ flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>{t('profile.email')}</label>
                <input 
                  type="email" 
                  value={inviteEmail} 
                  onChange={(e) => setInviteEmail(e.target.value)} 
                  placeholder="user@example.com"
                  required 
                  className="form-input" 
                  disabled={addingMember}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>{t('profile.language') === 'Language Settings' ? 'Role' : 'ロール'}</label>
                <select 
                  value={inviteRole} 
                  onChange={(e) => setInviteRole(e.target.value as any)} 
                  className="form-input"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  disabled={addingMember}
                >
                  <option value="member">{t('workspace.role.member')}</option>
                  <option value="guest">{t('workspace.role.guest')}</option>
                  <option value="group_admin">{t('workspace.role.groupAdmin')}</option>
                  <option value="owner">{t('workspace.role.owner')}</option>
                </select>
              </div>
              <button type="submit" className="submit-btn" style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', gap: '6px' }} disabled={addingMember}>
                <UserPlus size={16} />
                <span>{t('workspace.add')}</span>
              </button>
            </form>
          </div>
        )}

        {/* 3. メンバー一覧 */}
        <div className="settings-section" style={{ paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{t('workspace.memberList')} ({members.length})</h3>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('loading')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              {members.map((member) => {
                const modifiable = canModifyMember(member);
                return (
                  <div 
                    key={member.userId} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '8px 12px', 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: '6px' 
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px', overflow: 'hidden' }}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl.startsWith('http') ? member.avatarUrl : `http://127.0.0.1:8787${member.avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          member.displayName.substring(0, 1).toUpperCase()
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{member.displayName}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{member.email}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* ロール変更プルダウン */}
                      {modifiable ? (
                        <select 
                          value={member.role} 
                          onChange={(e) => handleRoleChange(member.userId, e.target.value as any)} 
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                        >
                          {isOwner && <option value="owner">{t('workspace.role.owner')}</option>}
                          <option value="group_admin">{t('workspace.role.groupAdmin')}</option>
                          <option value="member">{t('workspace.role.member')}</option>
                          <option value="guest">{t('workspace.role.guest')}</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Shield size={12} />
                          <span>
                            {member.role === 'owner' ? t('workspace.role.owner') : member.role === 'group_admin' ? t('workspace.role.groupAdmin') : member.role === 'member' ? t('workspace.role.member') : t('workspace.role.guest')}
                          </span>
                        </span>
                      )}

                      {/* 一時パスワードリセットボタン */}
                      {modifiable && (
                        <button 
                          onClick={() => handleResetPassword(member)}
                          className="submit-btn"
                          style={{ padding: '6px', borderRadius: '4px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent-primary, #4f46e5)', border: 'none', margin: 0, height: 'auto', display: 'flex', alignItems: 'center' }}
                          title={t('error') === 'Error' ? 'Issue temporary password' : '一時パスワードを発行'}
                        >
                          <Key size={14} />
                        </button>
                      )}

                      {/* 除外ボタン */}
                      {modifiable && (
                        <button 
                          onClick={() => handleDeleteMember(member.userId, member.displayName)}
                          className="danger-btn"
                          style={{ padding: '6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: 'none', margin: 0 }}
                          title={t('error') === 'Error' ? 'Remove' : '除外する'}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. ワークスペース削除（オーナーのみ） */}
        {isOwner && (
          <div className="danger-zone">
            <h3>{t('workspace.dangerZone')}</h3>
            <p>{t('workspace.deleteText')}</p>
            <button onClick={handleDeleteWorkspaceClick} type="button" className="danger-btn">
              <Trash2 size={16} />
              <span>{t('workspace.deleteBtn')}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStatusesTab = () => {
    return (
      <div className="settings-form-wrapper">
        <div className="settings-section">
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{t('workspace.statusTitle')}</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('workspace.statusHelp')}<br />
            {t('workspace.statusHelp2')}
          </p>

          {/* 新規ステータスの追加 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input 
              type="text" 
              value={newStatusName} 
              onChange={(e) => setNewStatusName(e.target.value)} 
              placeholder={t('workspace.statusAddPlaceholder')} 
              className="form-input"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button 
              type="button" 
              onClick={handleAddStatus} 
              className="submit-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 16px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Plus size={14} />
              <span>{t('workspace.add')}</span>
            </button>
          </div>

          {/* 現在のステータスリスト */}
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>{t('workspace.statusOrderLabel')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {customStatuses.map((status, index) => (
              <div 
                key={status} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '6px' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', background: 'var(--border-light)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'var(--text-muted)' }}>
                    {index + 1}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{status}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleRemoveStatus(status)}
                  className="danger-btn"
                  style={{ padding: '6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: 'none', cursor: 'pointer' }}
                  title={t('error') === 'Error' ? 'Delete' : '削除する'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* 保存ボタン */}
          <form onSubmit={handleSaveStatuses} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="submit-btn" style={{ padding: '11px 24px' }}>
              {t('workspace.statusSaveBtn')}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const settingsContent = (
    <div className={isEmbed ? "workspace-settings-embed" : "modal-content settings-modal"} style={isEmbed ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', padding: '24px', overflowY: 'auto' } : { maxWidth: activeTab === 'groups' ? '750px' : '650px', transition: 'max-width 0.2s' }} onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isEmbed && onMenuClick && (
            <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <Menu size={20} />
            </button>
          )}
          <h2>{t('workspace.mgmt')}</h2>
        </div>
        {!isEmbed && onClose && (
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

        {/* タブ切り替えバー */}
        <div className="settings-tabs">
          <button 
            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} 
            onClick={() => setActiveTab('members')}
          >
            <Shield size={16} />
            <span>{t('workspace.members')}</span>
          </button>
          {canAccessSettings && (
            <button 
              className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`} 
              onClick={() => setActiveTab('groups')}
            >
              <Users size={16} />
              <span>{t('workspace.groups')}</span>
            </button>
          )}
          {isOwner && (
            <button 
              className={`tab-btn ${activeTab === 'statuses' ? 'active' : ''}`} 
              onClick={() => setActiveTab('statuses')}
            >
              <Sliders size={16} />
              <span>{t('workspace.statuses')}</span>
            </button>
          )}
          {isOwner && (
            <button 
              className={`tab-btn ${activeTab === 'smtp' ? 'active' : ''}`} 
              onClick={() => setActiveTab('smtp')}
            >
              <Mail size={16} />
              <span>{t('workspace.smtp')}</span>
            </button>
          )}
        </div>

        <div className="settings-body">
          {activeTab === 'members' ? (
            renderMembersTab()
          ) : activeTab === 'groups' ? (
            /* グループ管理タブ */
            <WorkspaceGroupsTab 
              workspaceId={workspace!.id}
              workspaceMembers={members}
              currentUserRole={currentUserRole}
              currentUserLedGroups={currentUserLedGroups}
            />
          ) : activeTab === 'statuses' ? (
            renderStatusesTab()
          ) : (
            /* SMTP設定タブ */
            isOwner && <SmtpSettingsTab />
          )}
        </div>

        {/* 一時パスワード表示モーダル */}
        {tempPassword && resettingUser && (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1100, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setTempPassword(null); setResettingUser(null); }}>
            <div className="modal-content settings-modal" style={{ maxWidth: '420px', textAlign: 'center', padding: '24px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '12px' }}>
                {t('workspace.tempPwIssued')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px', lineHeight: '1.5' }}>
                {t('error') === 'Error' 
                  ? `This is the new temporary password for user "${resettingUser.displayName}". It cannot be displayed again once you close this window. Please copy it and share it with the user.`
                  : `ユーザー ${resettingUser.displayName} の新しい一時パスワードです。一度この画面を閉じると再表示できません。必ずコピーしてユーザーに伝えてください。`}
              </p>
              <div style={{
                background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                borderRadius: '6px',
                padding: '15px',
                fontSize: '20px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                marginBottom: '20px',
                letterSpacing: '1px',
                color: 'var(--accent-primary, #4f46e5)',
                userSelect: 'all'
              }}>
                {tempPassword}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    alert(t('error') === 'Error' ? 'Copied temporary password to clipboard.' : '一時パスワードをクリップボードにコピーしました。');
                  }}
                >
                  {t('workspace.copy')}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 0.5, padding: '10px' }}
                  onClick={() => {
                    setTempPassword(null);
                    setResettingUser(null);
                  }}
                >
                  {t('workspace.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (isEmbed) {
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
              <h1 className="channel-info-title" style={{ margin: 0 }}>{t('workspace.mgmt')}</h1>
              <span className="channel-info-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('error') === 'Error' ? 'Centralized management of members, groups, and settings' : 'メンバー・グループ・設定の一元管理'}
              </span>

              {/* モバイル用タブ切替セレクトボックス（PC時は CSS で非表示） */}
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
                className="settings-view-select-mobile"
                style={{
                  marginLeft: '12px',
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
                <option value="members">{t('workspace.members')}</option>
                {canAccessSettings && <option value="groups">{t('workspace.groups')}</option>}
                {isOwner && <option value="statuses">{t('workspace.statuses')}</option>}
                {isOwner && <option value="smtp">{t('workspace.smtp')}</option>}
              </select>
            </div>
          </div>

          {/* コントロール領域 */}
          {/* タブ切り替えバー (パディング付きスクロールエリアの外側に配置) */}
          <div className="settings-tabs" style={{ marginTop: 0 }}>
            <button 
              className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} 
              onClick={() => setActiveTab('members')}
            >
              <Shield size={16} />
              <span>{t('workspace.members')}</span>
            </button>
            {canAccessSettings && (
              <button 
                className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`} 
                onClick={() => setActiveTab('groups')}
              >
                <Users size={16} />
                <span>{t('workspace.groups')}</span>
              </button>
            )}
            {isOwner && (
              <button 
                className={`tab-btn ${activeTab === 'statuses' ? 'active' : ''}`} 
                onClick={() => setActiveTab('statuses')}
              >
                <Sliders size={16} />
                <span>{t('workspace.statuses')}</span>
              </button>
            )}
            {isOwner && (
              <button 
                className={`tab-btn ${activeTab === 'smtp' ? 'active' : ''}`} 
                onClick={() => setActiveTab('smtp')}
              >
                <Mail size={16} />
                <span>{t('workspace.smtp')}</span>
              </button>
            )}
          </div>

          {/* 各タブのコンテンツ (ここにパディングとスクロールを設定) */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1 }}>
              {activeTab === 'members' && renderMembersTab()}
              {activeTab === 'groups' && workspace && (
                <WorkspaceGroupsTab 
                  workspaceId={workspace.id}
                  workspaceMembers={members}
                  currentUserRole={currentUserRole}
                  currentUserLedGroups={currentUserLedGroups}
                />
              )}
              {activeTab === 'statuses' && renderStatusesTab()}
              {activeTab === 'smtp' && workspace && (
                <SmtpSettingsTab />
              )}
            </div>
          </div>
        </div>

        {/* パスワードリセット一時パスワードポップアップ */}
        {tempPassword && resettingUser && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: '24px' }}>
              <h3>{t('workspace.tempPwIssued')}</h3>
              <p style={{ margin: '12px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                {t('error') === 'Error' 
                  ? `The new temporary password for user "${resettingUser.displayName}" is below. Please share it with the user securely.`
                  : `ユーザー「${resettingUser.displayName}」の新しい一時パスワードは以下です。安全な方法でユーザーに伝えてください。`}
              </p>
              <div style={{
                background: 'rgba(14, 165, 233, 0.1)',
                border: '1px solid var(--border-focus)',
                padding: '12px',
                borderRadius: '6px',
                textAlign: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                color: 'var(--accent-primary)',
                margin: '16px 0'
              }}>
                {tempPassword}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                  onClick={() => {
                    setTempPassword(null);
                    setResettingUser(null);
                  }}
                >
                  {t('workspace.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {settingsContent}
    </div>
  );
};
