import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, Hash, Trash2, Upload, Loader } from 'lucide-react';
import { apiClient } from '../utils/apiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    displayName: string;
    email: string;
  };
  activeWorkspace: {
    id: string;
    name: string;
  } | null;
  activeChannel: {
    id: string;
    name: string;
    description?: string;
  } | null;
  onUpdateProfile: (displayName: string, avatarUrl: string | null) => Promise<void>;
  onUpdateWorkspace: (name: string) => Promise<void>;
  onDeleteWorkspace: () => Promise<void>;
  onUpdateChannel: (name: string, description: string) => Promise<void>;
  onDeleteChannel: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeWorkspace,
  activeChannel,
  onUpdateProfile,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onUpdateChannel,
  onDeleteChannel,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'channel'>('profile');
  
  // プロフィール編集ステート
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ワークスペース編集ステート
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || '');

  // チャンネル編集ステート
  const [channelName, setChannelName] = useState(activeChannel?.name || '');
  const [channelDescription, setChannelDescription] = useState(activeChannel?.description || '');

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUser.displayName);
      setWorkspaceName(activeWorkspace?.name || '');
      setChannelName(activeChannel?.name || '');
      setChannelDescription(activeChannel?.description || '');
      setActiveTab('profile');
    }
  }, [isOpen, currentUser, activeWorkspace, activeChannel]);

  if (!isOpen) return null;

  // アバターアップロード処理
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post<{ success: boolean; fileUrl: string }>('/api/files/upload', formData);
      if (response.success && response.fileUrl) {
        setAvatarUrl(response.fileUrl);
      }
    } catch (err: any) {
      alert(`アバターのアップロードに失敗しました: ${err.message || err}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateProfile(displayName, avatarUrl);
      alert('プロフィールを更新しました。');
    } catch (err: any) {
      alert(`プロフィールの更新に失敗しました: ${err.message || err}`);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateWorkspace(workspaceName);
      alert('ワークスペース名を更新しました。');
    } catch (err: any) {
      alert(`ワークスペースの更新に失敗しました: ${err.message || err}`);
    }
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateChannel(channelName, channelDescription);
      alert('チャンネル設定を更新しました。');
    } catch (err: any) {
      alert(`チャンネルの更新に失敗しました: ${err.message || err}`);
    }
  };

  const handleDeleteWSClick = async () => {
    if (confirm(`本当にワークスペース「${activeWorkspace?.name}」を削除しますか？\nこの操作は取り消せません。所属するすべてのチャンネルやメッセージが削除されます。`)) {
      try {
        await onDeleteWorkspace();
        alert('ワークスペースを削除しました。');
        onClose();
      } catch (err: any) {
        alert(`ワークスペースの削除に失敗しました: ${err.message || err}`);
      }
    }
  };

  const handleDeleteChannelClick = async () => {
    if (confirm(`本当にチャンネル「#${activeChannel?.name}」を削除しますか？\nこの操作は取り消せません。`)) {
      try {
        await onDeleteChannel();
        alert('チャンネルを削除しました。');
        onClose();
      } catch (err: any) {
        alert(`チャンネルの削除に失敗しました: ${err.message || err}`);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* モーダルヘッダー */}
        <div className="modal-header">
          <h2>設定</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* タブ切り替え */}
        <div className="settings-tabs">
          <button 
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} />
            <span>プロフィール</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveTab('workspace')}
            disabled={!activeWorkspace}
          >
            <Briefcase size={16} />
            <span>ワークスペース</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'channel' ? 'active' : ''}`}
            onClick={() => setActiveTab('channel')}
            disabled={!activeChannel}
          >
            <Hash size={16} />
            <span>チャンネル</span>
          </button>
        </div>

        {/* 設定フォーム本体 */}
        <div className="settings-body">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="settings-form">
              <div className="form-group">
                <label>メールアドレス</label>
                <input type="text" value={currentUser.email} disabled className="form-input disabled" />
                <span className="form-help">メールアドレスは変更できません。</span>
              </div>
              <div className="form-group">
                <label>表示名</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  required 
                  className="form-input" 
                />
              </div>
              <div className="form-group">
                <label>アバター画像</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
                  <div className="user-avatar" style={{ width: '50px', height: '50px', fontSize: '20px' }}>
                    {avatarUrl ? (
                      <img src={avatarUrl.startsWith('http') ? avatarUrl : `http://127.0.0.1:8787${avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      displayName.substring(0, 1).toUpperCase()
                    )}
                  </div>
                  <label className="upload-btn">
                    {uploadingAvatar ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
                    <span>{uploadingAvatar ? 'アップロード中...' : '画像をアップロード'}</span>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} disabled={uploadingAvatar} />
                  </label>
                </div>
              </div>
              <button type="submit" className="submit-btn" style={{ marginTop: '10px' }}>保存する</button>
            </form>
          )}

          {activeTab === 'workspace' && activeWorkspace && (
            <div className="settings-form-wrapper">
              <form onSubmit={handleSaveWorkspace} className="settings-form">
                <div className="form-group">
                  <label>ワークスペース名</label>
                  <input 
                    type="text" 
                    value={workspaceName} 
                    onChange={(e) => setWorkspaceName(e.target.value)} 
                    required 
                    className="form-input" 
                  />
                </div>
                <button type="submit" className="submit-btn">保存する</button>
              </form>
              <div className="danger-zone">
                <h3>危険区域</h3>
                <p>ワークスペースを削除すると、紐づくすべてのデータが削除されます。この操作は元に戻せません。</p>
                <button onClick={handleDeleteWSClick} type="button" className="danger-btn">
                  <Trash2 size={16} />
                  <span>ワークスペースを削除する</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'channel' && activeChannel && (
            <div className="settings-form-wrapper">
              <form onSubmit={handleSaveChannel} className="settings-form">
                <div className="form-group">
                  <label>チャンネル名</label>
                  <input 
                    type="text" 
                    value={channelName} 
                    onChange={(e) => setChannelName(e.target.value)} 
                    required 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>説明</label>
                  <textarea 
                    value={channelDescription} 
                    onChange={(e) => setChannelDescription(e.target.value)} 
                    className="form-textarea" 
                    placeholder="チャンネルの目的などを入力してください"
                  />
                </div>
                <button type="submit" className="submit-btn">保存する</button>
              </form>
              <div className="danger-zone">
                <h3>危険区域</h3>
                <p>チャンネルを削除すると、そのチャンネル内のすべてのメッセージが削除されます。</p>
                <button onClick={handleDeleteChannelClick} type="button" className="danger-btn">
                  <Trash2 size={16} />
                  <span>チャンネルを削除する</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
