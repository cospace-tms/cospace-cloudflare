import React, { useState, useEffect } from 'react';
import { X, Upload, Loader } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
    language?: string;
  };
  onUpdateProfile: (displayName: string, avatarUrl: string | null, language: string) => Promise<void>;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
}) => {
  const { setLanguage: setGlobalLanguage, t } = useLanguage();
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl || null);
  const [profileLang, setProfileLang] = useState<string>(currentUser.language || 'ja');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // パスワード変更ステート
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUser.displayName);
      setAvatarUrl(currentUser.avatarUrl || null);
      setProfileLang(currentUser.language || 'ja');
      // モーダルを開いた時にパスワード入力をリセット
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

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
      alert(`${t('profile.updateFailed')} (Avatar): ${err.message || err}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateProfile(displayName, avatarUrl, profileLang);
      setGlobalLanguage(profileLang as 'ja' | 'en');
      alert(t('profile.updateSuccess'));
      onClose();
    } catch (err: any) {
      alert(`${t('profile.updateFailed')}: ${err.message || err}`);
    }
  };

  // パスワード変更送信処理
  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ text: t('profile.pwRequired'), type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: t('profile.pwMismatch'), type: 'error' });
      return;
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasNonalphas = /[^A-Za-z0-9]/.test(newPassword);

    if (newPassword.length < 8 || !(hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas)) {
      setPasswordMessage({
        text: t('profile.pwFormatError'),
        type: 'error'
      });
      return;
    }

    try {
      const response = await apiClient.post<{ success: boolean; message?: string; error?: string }>('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      if (response.success) {
        setPasswordMessage({ text: t('profile.pwChangeSuccess'), type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ text: response.error || response.message || t('profile.pwChangeFailed'), type: 'error' });
      }
    } catch (err: any) {
      setPasswordMessage({ text: err.message || t('profile.pwChangeFailed'), type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" style={{ maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('profile.title')}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label>{t('profile.email')}</label>
              <input type="text" value={currentUser.email} disabled className="form-input disabled" />
              <span className="form-help">{t('profile.emailHelp')}</span>
            </div>
            <div className="form-group">
              <label>{t('profile.displayName')}</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                required 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>{t('profile.language')}</label>
              <select
                value={profileLang}
                onChange={(e) => setProfileLang(e.target.value)}
                className="form-input"
              >
                <option value="ja">日本語 (Japanese)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('profile.avatar')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
                <div className="user-avatar" style={{ width: '50px', height: '50px', fontSize: '20px', overflow: 'hidden' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl.startsWith('http') ? avatarUrl : `http://127.0.0.1:8787${avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    displayName.substring(0, 1).toUpperCase()
                  )}
                </div>
                <label className="upload-btn">
                  {uploadingAvatar ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
                  <span>{uploadingAvatar ? t('profile.uploading') : t('profile.uploadImage')}</span>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} disabled={uploadingAvatar} />
                </label>
              </div>
            </div>
            <button type="submit" className="submit-btn" style={{ marginTop: '10px' }} disabled={uploadingAvatar}>
              {t('profile.save')}
            </button>

          {/* パスワード変更セクション */}
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
              {t('profile.pwChange')}
            </h3>
            
            {passwordMessage && (
              <div style={{
                padding: '8px 12px',
                background: passwordMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: passwordMessage.type === 'success' ? '#10b981' : '#ef4444',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '12px',
                border: passwordMessage.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                {passwordMessage.text}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label>{t('profile.currentPw')}</label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                className="form-input" 
                placeholder={t('profile.currentPw')}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label>{t('profile.newPw')}</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="form-input" 
                placeholder={t('profile.newPw')}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
                {t('profile.newPwHelp')}
              </span>
            </div>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label>{t('profile.confirmPw')}</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="form-input" 
                placeholder={t('profile.confirmPw')}
              />
            </div>
            <button 
              type="button" 
              onClick={handleChangePassword}
              className="submit-btn" 
              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-light)' }}
            >
              {t('profile.pwChangeBtn')}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
