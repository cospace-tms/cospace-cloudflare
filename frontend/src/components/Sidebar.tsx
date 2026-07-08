import React, { useState } from 'react';
import { Hash, Plus, Settings, Inbox, User, LogOut, MoreHorizontal, Lock, MessageCircle, Globe, CheckSquare, ToggleLeft, ChevronRight, ChevronLeft, BookOpen, Image, Sun, Moon, Home, Menu } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  groupId?: string | null;
  type?: string;
}

interface Workspace {
  id: string;
  name: string;
}

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  channels: Channel[];
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  activeView: 'dashboard' | 'chat' | 'items' | 'inbox' | 'workspace_doc' | 'media' | 'workspace_settings';
  setActiveView: (view: 'dashboard' | 'chat' | 'items' | 'inbox' | 'workspace_doc' | 'media' | 'workspace_settings') => void;
  unreadNotificationsCount: number;
  channelUnreads: Record<string, boolean>;
  currentUser: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
    language?: string;
  } | null;
  currentUserRole: 'owner' | 'group_admin' | 'member' | 'guest';
  currentUserLedGroups: string[];
  onLogout?: () => void;
  onOpenUserProfile?: () => void;
  onOpenWorkspaceMembers?: () => void;
  onOpenChannelSettings?: (channel: Channel) => void;
  onOpenCreateWorkspace?: () => void;
  onOpenCreateChannel?: () => void;
  onOpenBrowseChannels?: () => void;
  onOpenStartDm?: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  activeWorkspaceId,
  setActiveWorkspaceId,
  channels,
  activeChannelId,
  setActiveChannelId,
  activeView,
  setActiveView,
  unreadNotificationsCount,
  channelUnreads,
  currentUser,
  currentUserRole,
  currentUserLedGroups,
  onLogout,
  onOpenUserProfile,
  onOpenWorkspaceMembers,
  onOpenChannelSettings,
  onOpenCreateWorkspace,
  onOpenCreateChannel,
  onOpenBrowseChannels,
  onOpenStartDm,
  isCollapsed,
  setIsCollapsed,
}) => {
  const { t } = useLanguage();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);
  const [isDmsExpanded, setIsDmsExpanded] = useState(true);

  const isOwner = currentUserRole === 'owner';
  const isGroupAdmin = currentUserRole === 'group_admin';

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cospace_theme') as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('cospace_theme', nextTheme);
    document.documentElement.classList.toggle('theme-light', nextTheme === 'light');
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${showUserMenu ? 'popover-open' : ''}`}>
      {/* 1. チャンネル・ユーザー情報列 (全体一列) */}
      <div className="channel-column" style={{ padding: '16px 0 0', minWidth: isCollapsed ? 'auto' : '240px', width: isCollapsed ? 'auto' : '240px' }}>
        
        {/* 最上部：ロゴ ＆ コラプストグル */}
        {!isCollapsed ? (
          <div style={{ padding: '0 16px 16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
              cospace
            </span>
            <button
              className="input-icon-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('error') === 'Error' ? 'Minimize menu' : 'メニューを最小化'}
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)', marginBottom: '16px' }}>
            <button
              className="input-icon-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(false);
              }}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('error') === 'Error' ? 'Expand menu' : 'メニューを展開'}
            >
              <Menu size={16} />
            </button>
          </div>
        )}

        {/* グローバル機能 (ホーム、受信箱) - ゲスト以外 */}
        {currentUserRole !== 'guest' && (
          <ul className="channel-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: isCollapsed ? '0 4px' : '0 8px' }}>
            {/* ホーム (ダッシュボード) */}
            <li
              className={`channel-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('dashboard');
                setActiveChannelId(null);
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '8px', cursor: 'pointer', paddingLeft: isCollapsed ? '0' : '12px', paddingRight: isCollapsed ? '0' : '12px' }}
            >
              <Home size={16} style={{ flexShrink: 0 }} />
              {!isCollapsed && <span style={{ fontWeight: 'bold' }}>{t('error') === 'Error' ? 'Home' : 'ホーム'}</span>}
            </li>

            {/* 受信箱 */}
            <li
              className={`channel-item ${activeView === 'inbox' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('inbox');
                setActiveChannelId(null);
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', cursor: 'pointer', paddingLeft: isCollapsed ? '0' : '12px', paddingRight: isCollapsed ? '0' : '8px', position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <Inbox size={16} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span style={{ fontWeight: 'bold' }}>{t('sidebar.inbox')}</span>}
                {isCollapsed && unreadNotificationsCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'var(--accent-danger)',
                    color: '#fff',
                    fontSize: '8px',
                    padding: '1px 4px',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    lineHeight: '1'
                  }}>
                    {unreadNotificationsCount}
                  </span>
                )}
              </div>
              {!isCollapsed && unreadNotificationsCount > 0 && (
                <span style={{
                  background: 'var(--accent-danger)',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  lineHeight: '1.2'
                }}>
                  {unreadNotificationsCount}
                </span>
              )}
            </li>
          </ul>
        )}

        {/* ワークスペース切り替えセクション */}
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: isCollapsed ? '12px' : '8px', alignItems: isCollapsed ? 'center' : 'stretch', padding: isCollapsed ? '16px 0 0' : '16px 16px 12px', borderTop: '1px solid var(--border-light)', borderBottom: 'none', marginBottom: '4px' }}>
          {!isCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('error') === 'Error' ? 'Workspaces' : 'ワークスペース'}
                </span>
                {currentUserRole !== 'guest' && (
                  <button
                    className="input-icon-btn"
                    title={t('sidebar.addWorkspace')}
                    onClick={() => onOpenCreateWorkspace?.()}
                    style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0 }}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  value={activeWorkspaceId || ''}
                  onChange={(e) => setActiveWorkspaceId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 32px 8px 12px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    appearance: 'none',
                    outline: 'none',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {workspaces.map((ws: any) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} {ws.unreadCount > 0 ? '🔴' : ''}
                    </option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: '12px', pointerEvents: 'none', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                  ▼
                </div>
                {(() => {
                  const hasOtherUnread = workspaces.some((ws: any) => ws.id !== activeWorkspaceId && ws.unreadCount > 0);
                  if (hasOtherUnread) {
                    return (
                      <span style={{
                        position: 'absolute',
                        top: '-4px',
                        left: '-4px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-danger)',
                        border: '1.5px solid var(--bg-sidebar)',
                        boxShadow: '0 0 4px var(--accent-danger)'
                      }}></span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
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
                fontSize: '12px'
              }}>
                {activeWorkspace?.name ? activeWorkspace.name.substring(0, 2).toUpperCase() : 'WS'}
              </div>
              {(() => {
                const hasOtherUnread = workspaces.some((ws: any) => ws.id !== activeWorkspaceId && ws.unreadCount > 0);
                if (hasOtherUnread) {
                  return (
                    <span style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-danger)',
                      border: '1.5px solid var(--bg-sidebar)'
                    }}></span>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>

        {/* スクロール可能なサイドバーメインエリア */}
        <div className="sidebar-scrollable-area">
          {/* ワークスペースメニュー（通常時アイコン横並び、最小化時縦並び） - ゲスト以外 */}
          {currentUserRole !== 'guest' && (!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', padding: '4px 16px 12px' }}>
              {/* ドキュメント */}
              <button
                onClick={() => {
                  setActiveView('workspace_doc');
                  setActiveChannelId(null);
                }}
                className={`sidebar-icon-btn ${activeView === 'workspace_doc' ? 'active' : ''}`}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeView === 'workspace_doc' ? 'var(--bg-active)' : 'transparent',
                  border: '1px solid ' + (activeView === 'workspace_doc' ? 'var(--border-focus)' : 'var(--border-light)'),
                  color: activeView === 'workspace_doc' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                title={t('sidebar.workspaceDoc')}
              >
                <BookOpen size={18} />
              </button>

              {/* タスク */}
              <button
                onClick={() => {
                  setActiveView('items');
                  setActiveChannelId(null);
                }}
                className={`sidebar-icon-btn ${activeView === 'items' ? 'active' : ''}`}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeView === 'items' ? 'var(--bg-active)' : 'transparent',
                  border: '1px solid ' + (activeView === 'items' ? 'var(--border-focus)' : 'var(--border-light)'),
                  color: activeView === 'items' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                title={t('error') === 'Error' ? 'Tasks & Schedule' : 'タスク・予定'}
              >
                <CheckSquare size={18} />
              </button>

              {/* メディア */}
              <button
                onClick={() => {
                  setActiveView('media');
                  setActiveChannelId(null);
                }}
                className={`sidebar-icon-btn ${activeView === 'media' ? 'active' : ''}`}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeView === 'media' ? 'var(--bg-active)' : 'transparent',
                  border: '1px solid ' + (activeView === 'media' ? 'var(--border-focus)' : 'var(--border-light)'),
                  color: activeView === 'media' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                title={t('sidebar.mediaLibrary')}
              >
                <Image size={18} />
              </button>

              {/* 設定 / メンバー */}
              {onOpenWorkspaceMembers && (
                <button
                  onClick={() => {
                    setActiveView('workspace_settings');
                    setActiveChannelId(null);
                  }}
                  className={`sidebar-icon-btn ${activeView === 'workspace_settings' ? 'active' : ''}`}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: activeView === 'workspace_settings' ? 'var(--bg-active)' : 'transparent',
                    border: '1px solid ' + (activeView === 'workspace_settings' ? 'var(--border-focus)' : 'var(--border-light)'),
                    color: activeView === 'workspace_settings' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  title={t('sidebar.members')}
                >
                  <Settings size={18} />
                </button>
              )}
            </div>
          ) : (
            /* 最小化時 (isCollapsed) は縦並び */
            <div className="sidebar-section" style={{ padding: '0 4px' }}>
              <div style={{ borderBottom: '1px solid var(--border-light)', margin: '8px 0' }} />
              <ul className="channel-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li
                  className={`channel-item ${activeView === 'workspace_doc' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('workspace_doc');
                    setActiveChannelId(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '8px 0' }}
                  title={t('sidebar.workspaceDoc')}
                >
                  <BookOpen size={16} style={{ flexShrink: 0 }} />
                </li>
                <li
                  className={`channel-item ${activeView === 'items' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('items');
                    setActiveChannelId(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '8px 0' }}
                  title={t('error') === 'Error' ? 'Tasks & Schedule' : 'タスク・予定'}
                >
                  <CheckSquare size={16} style={{ flexShrink: 0 }} />
                </li>
                <li
                  className={`channel-item ${activeView === 'media' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView('media');
                    setActiveChannelId(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '8px 0' }}
                  title={t('sidebar.mediaLibrary')}
                >
                  <Image size={16} style={{ flexShrink: 0 }} />
                </li>
                {onOpenWorkspaceMembers && (
                  <li
                    className={`channel-item ${activeView === 'workspace_settings' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('workspace_settings');
                      setActiveChannelId(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '8px 0' }}
                    title={t('sidebar.members')}
                  >
                    <Settings size={16} style={{ flexShrink: 0 }} />
                  </li>
                )}
              </ul>
            </div>
          ))}

          {/* チャンネル一覧セクション */}
          <div className="sidebar-section" style={{ padding: isCollapsed ? '0 4px' : '0 8px' }}>
            {!isCollapsed ? (
              <div 
                className="section-title"
                onClick={() => setIsChannelsExpanded(!isChannelsExpanded)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ChevronRight 
                    size={14} 
                    style={{ 
                      transform: isChannelsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: 'var(--text-muted)',
                      flexShrink: 0
                    }} 
                  />
                  <span>{t('sidebar.channels')}</span>
                </div>
                {currentUserRole !== 'guest' && (
                  <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="input-icon-btn"
                      title={t('sidebar.browseChannels')}
                      onClick={() => onOpenBrowseChannels?.()}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Globe size={14} />
                    </button>
                    <button
                      className="input-icon-btn"
                      title={t('sidebar.addChannel')}
                      onClick={() => onOpenCreateChannel?.()}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ borderBottom: '1px solid var(--border-light)', margin: '8px 0' }} />
            )}
            {(isChannelsExpanded || isCollapsed) && (
              <ul className="channel-list">
              {channels.filter(c => c.type !== 'dm').map((channel) => {
                const isActive = channel.id === activeChannelId;
                const hasUnread = channelUnreads[channel.id];
                
                const canEditChannel = (): boolean => {
                  if (isOwner) return true;
                  if (isGroupAdmin && channel.groupId) {
                    return currentUserLedGroups.includes(channel.groupId);
                  }
                  return false;
                };

                return (
                  <li
                    key={channel.id}
                    className={`channel-item ${(isActive && activeView === 'chat') ? 'active' : ''}`}
                    onClick={() => {
                      setActiveChannelId(channel.id);
                      setActiveView('chat');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      paddingLeft: isCollapsed ? '0' : '12px',
                      paddingRight: isCollapsed ? '0' : '8px',
                      fontWeight: hasUnread ? '700' : '500',
                      color: hasUnread ? 'var(--text-primary)' : 'var(--text-muted)',
                      position: 'relative'
                    }}
                    title={isCollapsed ? channel.name : undefined}
                  >
                    {isCollapsed ? (
                      <div 
                        className="channel-initial-avatar" 
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: isActive ? 'var(--primary-color)' : 'var(--bg-panel)',
                          color: isActive ? '#fff' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        {channel.name.substring(0, 1).toUpperCase()}
                        {hasUnread && !isActive && (
                          <span style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--primary-color)',
                            border: '1px solid var(--bg-sidebar)'
                          }}></span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {channel.isPrivate ? (
                            <Lock size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
                          ) : (
                            <Hash size={16} style={{ flexShrink: 0 }} />
                          )}
                          <span>{channel.name}</span>
                        </div>
                        
                        {hasUnread && !isActive && (
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--primary-color)',
                            flexShrink: 0,
                            marginRight: '8px'
                          }}></span>
                        )}

                        {canEditChannel() && onOpenChannelSettings && (
                          <button
                            className="channel-menu-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChannelSettings(channel);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: isActive ? 1 : 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="チャンネル設定"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
          </div>

          {/* ダイレクトメッセージセクション - ゲスト以外 */}
          {currentUserRole !== 'guest' && (
            <div className="sidebar-section" style={{ padding: isCollapsed ? '0 4px' : '0 8px' }}>
              {!isCollapsed ? (
                <div 
                  className="section-title"
                  onClick={() => setIsDmsExpanded(!isDmsExpanded)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChevronRight 
                      size={14} 
                      style={{ 
                        transform: isDmsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        color: 'var(--text-muted)',
                        flexShrink: 0
                      }} 
                    />
                    <span>{t('sidebar.dms')}</span>
                  </div>
                  {onOpenStartDm && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <button
                        className="input-icon-btn"
                        title={t('sidebar.startDm')}
                        onClick={onOpenStartDm}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ borderBottom: '1px solid var(--border-light)', margin: '8px 0' }} />
              )}
              {(isDmsExpanded || isCollapsed) && (
                <ul className="channel-list">
                {channels.filter(c => c.type === 'dm').map((channel) => {
                  const isActive = channel.id === activeChannelId;
                  const hasUnread = channelUnreads[channel.id];

                  const getDmDisplayName = (dmName: string): string => {
                    if (!currentUser) return dmName;
                    const names = dmName.split(',').map((n) => n.trim());
                    const filtered = names.filter((n) => n !== currentUser.displayName);
                    if (filtered.length === 0) return dmName;
                    return filtered.join(', ');
                  };

                  const dmDisplayName = getDmDisplayName(channel.name);

                  return (
                    <li
                      key={channel.id}
                      className={`channel-item ${(isActive && activeView === 'chat') ? 'active' : ''}`}
                      onClick={() => {
                        setActiveChannelId(channel.id);
                        setActiveView('chat');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'space-between',
                        paddingLeft: isCollapsed ? '0' : '12px',
                        paddingRight: isCollapsed ? '0' : '8px',
                        fontWeight: hasUnread ? '700' : '500',
                        color: hasUnread ? 'var(--text-primary)' : 'var(--text-muted)',
                        position: 'relative'
                      }}
                      title={isCollapsed ? dmDisplayName : undefined}
                    >
                      {isCollapsed ? (
                        <div 
                          className="channel-initial-avatar" 
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isActive ? 'var(--primary-color)' : 'var(--bg-panel)',
                            color: isActive ? '#fff' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          {dmDisplayName.substring(0, 1).toUpperCase()}
                          {hasUnread && !isActive && (
                            <span style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--primary-color)',
                              border: '1px solid var(--bg-sidebar)'
                            }}></span>
                          )}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            <MessageCircle size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
                            <span>{dmDisplayName}</span>
                          </div>

                          {hasUnread && !isActive && (
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--primary-color)',
                              flexShrink: 0,
                              marginRight: '8px'
                            }}></span>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
          )}
        </div>

        {/* ユーザー情報フッター */}
        {currentUser && (
          <div className="sidebar-footer" style={{ position: 'relative', padding: isCollapsed ? '12px 0' : '12px 16px', borderTop: '1px solid var(--border-light)' }}>
            {isCollapsed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                <div 
                  className="user-avatar" 
                  style={{ overflow: 'hidden', width: '32px', height: '32px', cursor: 'pointer' }}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {currentUser.avatarUrl ? (
                    <img 
                      src={currentUser.avatarUrl.startsWith('http') ? currentUser.avatarUrl : `http://127.0.0.1:8787${currentUser.avatarUrl}`} 
                      alt="Avatar" 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    currentUser.displayName.substring(0, 1).toUpperCase()
                  )}
                </div>
                
                {/* テーマ切り替えトグルのみ表示 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="input-icon-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={t('sidebar.theme')}
                  >
                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div className="user-avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                    {currentUser.avatarUrl ? (
                      <img 
                        src={currentUser.avatarUrl.startsWith('http') ? currentUser.avatarUrl : `http://127.0.0.1:8787${currentUser.avatarUrl}`} 
                        alt="Avatar" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    ) : (
                      currentUser.displayName.substring(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="user-info" style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.displayName}</div>
                    <div className="user-status" style={{ fontSize: '10px' }}>
                      {t('error') === 'Error' 
                        ? `Active (${currentUserRole === 'owner' ? 'Owner' : currentUserRole === 'member' ? 'Member' : 'Guest'})` 
                        : `アクティブ (${currentUserRole === 'owner' ? '管理者' : currentUserRole === 'member' ? 'メンバー' : 'ゲスト'})`}
                    </div>
                  </div>
                </div>
                
                {/* テーマ切り替えトグルのみ表示 */}
                <button
                  className="input-icon-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTheme();
                  }}
                  style={{ color: 'var(--text-muted)', marginLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={t('sidebar.theme')}
                >
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
              </div>
            )}

            {/* アバタークリックポップアップメニュー */}
            {showUserMenu && (
              <div 
                className="user-popover-menu" 
                style={{ 
                  position: 'absolute', 
                  bottom: '100%', 
                  left: isCollapsed ? '40px' : '10px', 
                  zIndex: 100, 
                  background: 'var(--bg-sidebar)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '8px', 
                  padding: '6px 0', 
                  boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.2)',
                  minWidth: '160px',
                  marginBottom: '8px'
                }}
              >
                {onOpenUserProfile && (
                  <button 
                    onClick={() => {
                      onOpenUserProfile();
                      setShowUserMenu(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                  >
                    <User size={14} />
                    <span>{t('profile.title')}</span>
                  </button>
                )}
                {onLogout && (
                  <button 
                    onClick={() => {
                      onLogout();
                      setShowUserMenu(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--accent-danger)', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderTop: '1px solid var(--border-light)' }}
                  >
                    <LogOut size={14} />
                    <span>{t('sidebar.logout')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
