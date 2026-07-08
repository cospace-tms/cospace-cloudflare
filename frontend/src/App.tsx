import React, { useState, useEffect } from 'react';
import { SetupPage } from './pages/SetupPage';
import { ChatPage } from './pages/ChatPage';
import { apiClient } from './utils/apiClient';
import { LanguageProvider, useLanguage } from './utils/i18n';
import './global.css';

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  workspaceId: string;
  defaultChannelId: string;
  token?: string;
  language?: string;
}

function AppContent() {
  const { language, setLanguage, t } = useLanguage();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ログイン用の入力状態（セットアップ済み時の簡易ログイン用）
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // パスワード復旧用の入力状態
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // 1. 初期状態チェック (サイレントリフレッシュによるセッション復元 & セットアップ要否判定)
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // テーマの初期適用
        const cachedTheme = localStorage.getItem('cospace_theme') || 'dark';
        document.documentElement.classList.toggle('theme-light', cachedTheme === 'light');

        // サイレントリフレッシュによりアクセストークンを再取得してログイン状態を復元
        try {
          const token = await apiClient.refreshAccessToken();
          const cachedSession = localStorage.getItem('cospace_session');
          if (cachedSession) {
            const parsed = JSON.parse(cachedSession) as UserSession;
            apiClient.setToken(token);
            apiClient.setWorkspaceId(parsed.workspaceId);
            apiClient.setUserId(parsed.id);
            setSession(parsed);
            if (parsed.language === 'ja' || parsed.language === 'en') {
              setLanguage(parsed.language);
            }
          }
        } catch (refreshErr) {
          // リフレッシュに失敗した場合は未ログイン状態とする
          console.log('No active session found or refresh failed:', refreshErr);
          localStorage.removeItem('cospace_session');
          apiClient.setToken(null);
          apiClient.setWorkspaceId(null);
          apiClient.setUserId(null);
        }

        const response = await apiClient.get<{ setupRequired: boolean }>('/api/setup/status');
        setSetupRequired(response.setupRequired);
      } catch (err: any) {
        console.error('Failed to get setup status:', err);
        setError(t('error') === 'Error' ? 'Failed to connect to Workers backend. Please make sure the server is running.' : 'Workers バックエンドへの接続に失敗しました。サーバーが起動しているか確認してください。');
      } finally {
        setLoading(false);
      }
    };

    checkSetupStatus();
  }, []);

  // グローバルなログアウトイベントの購読
  useEffect(() => {
    const handleGlobalLogout = () => {
      handleLogout();
    };

    window.addEventListener('auth:logout', handleGlobalLogout);
    return () => {
      window.removeEventListener('auth:logout', handleGlobalLogout);
    };
  }, []);

  // 2. セットアップ完了時のハンドラー
  const handleSetupComplete = (data: {
    userId: string;
    workspaceId: string;
    defaultChannelId: string;
    userEmail: string;
    displayName: string;
    token?: string;
    language?: string;
  }) => {
    const newSession: UserSession = {
      id: data.userId,
      displayName: data.displayName,
      email: data.userEmail,
      workspaceId: data.workspaceId,
      defaultChannelId: data.defaultChannelId,
      token: data.token,
      language: data.language,
    };

    localStorage.setItem('cospace_session', JSON.stringify(newSession));
    apiClient.setWorkspaceId(data.workspaceId);
    apiClient.setUserId(data.userId);
    if (data.token) {
      apiClient.setToken(data.token);
    }
    setSession(newSession);
    if (data.language === 'ja' || data.language === 'en') {
      setLanguage(data.language);
    }
    setSetupRequired(false);
  };

  // 3. ログイン完了時のハンドラー
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data: UserSession;
      }>('/api/auth/login', { email, password });

      if (response.success && response.data) {
        localStorage.setItem('cospace_session', JSON.stringify(response.data));
        apiClient.setWorkspaceId(response.data.workspaceId);
        apiClient.setUserId(response.data.id);
        if (response.data.token) {
          apiClient.setToken(response.data.token);
        }
        setSession(response.data);
        if (response.data.language === 'ja' || response.data.language === 'en') {
          setLanguage(response.data.language);
        }
        return;
      }
    } catch (err: any) {
      setLoginError(err.message || (t('error') === 'Error' ? 'Login failed.' : 'ログインに失敗しました。'));
    } finally {
      setLoginLoading(false);
    }
  };

  // 4. リカバリーコードによるパスワード再設定ハンドラー
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (newPassword.length < 8) {
      setRecoveryError(t('profile.pwFormatError'));
      return;
    }

    setRecoveryLoading(true);

    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: UserSession;
      }>('/api/auth/recovery', {
        email: recoveryEmail,
        recoveryCode: recoveryCode.trim(),
        newPassword,
      });

      if (response.success && response.data) {
        setRecoverySuccess(t('recovery.success'));
        
        // ログイン処理と同様にセッションを確立
        setTimeout(() => {
          localStorage.setItem('cospace_session', JSON.stringify(response.data));
          apiClient.setWorkspaceId(response.data.workspaceId);
          apiClient.setUserId(response.data.id);
          if (response.data.token) {
            apiClient.setToken(response.data.token);
          }
          setSession(response.data);
          if (response.data.language === 'ja' || response.data.language === 'en') {
            setLanguage(response.data.language);
          }
          setShowRecovery(false);
          setRecoveryEmail('');
          setRecoveryCode('');
          setNewPassword('');
          setRecoverySuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      console.error('Recovery failed:', err);
      setRecoveryError(err.message || t('recovery.backToLogin') === 'Back to Login' ? 'Failed to reset password. Please check your recovery code.' : 'パスワードの再設定に失敗しました。リカバリーコードを確認してください。');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (err) {
      console.warn('Backend logout failed:', err);
    }
    localStorage.removeItem('cospace_session');
    apiClient.setWorkspaceId(null);
    apiClient.setUserId(null);
    apiClient.setToken(null);
    setSession(null);
    // ログアウト時に再度セットアップチェック
    setLoading(true);
    apiClient.get<{ setupRequired: boolean }>('/api/setup/status')
      .then((res) => setSetupRequired(res.setupRequired))
      .catch((err) => {
        console.error('Failed to get setup status during logout:', err);
        setError('Workers バックエンドへの接続に失敗しました。サーバーが起動しているか確認してください。');
      })
      .finally(() => setLoading(false));
  };

  const handleUpdateSession = (displayName: string, avatarUrl: string | null, language?: string) => {
    if (!session) return;
    const newSession = { ...session, displayName, avatarUrl, language };
    localStorage.setItem('cospace_session', JSON.stringify(newSession));
    setSession(newSession);
    if (language === 'ja' || language === 'en') {
      setLanguage(language);
    }
  };

  // 5. ローディング画面
  if (loading) {
    return (
      <div className="setup-container">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)' }}>{t('connection.checking')}</p>
        </div>
      </div>
    );
  }

  // 6. 接続エラー画面
  if (error && setupRequired === null) {
    return (
      <div className="setup-container">
        <div className="setup-card" style={{ textAlign: 'center' }}>
          <h2 className="setup-title" style={{ color: 'var(--accent-danger)' }}>{t('connection.error')}</h2>
          <p className="setup-subtitle" style={{ margin: '16px 0 24px' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {t('connection.retry')}
          </button>
        </div>
      </div>
    );
  }

  // 7. 初期セットアップが必要な場合
  if (setupRequired) {
    return <SetupPage onSetupComplete={handleSetupComplete} />;
  }

  // 8. ログインが必要な場合（セッションがない場合）
  if (!session) {
    const renderLangSelector = () => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', position: 'absolute', top: 10, right: 10 }}>
        <button
          onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
        >
          {language === 'ja' ? 'English' : '日本語'}
        </button>
      </div>
    );

    if (showRecovery) {
      return (
        <div className="setup-container" style={{ position: 'relative' }}>
          {renderLangSelector()}
          <div className="setup-card" style={{ maxWidth: '500px' }}>
            <h2 className="setup-title">{t('recovery.title')}</h2>
            <p className="setup-subtitle">{t('recovery.subtitle')}</p>

            {recoveryError && <div className="alert-error" style={{ marginBottom: '15px' }}>{recoveryError}</div>}
            {recoverySuccess && <div className="alert-success" style={{
              background: 'rgba(16, 185, 129, 0.1)',
              borderLeft: '4px solid #10b981',
              padding: '12px',
              borderRadius: '4px',
              color: '#10b981',
              fontSize: '13px',
              marginBottom: '15px',
              textAlign: 'center'
            }}>{recoverySuccess}</div>}

            {/* 管理者向けリカバリーフォーム */}
            <form onSubmit={handleRecoverySubmit}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '15px 0 10px', color: 'var(--text-primary)' }}>
                {t('recovery.ownerTitle')}
              </h3>
              
              <div className="form-group">
                <label className="form-label">{t('recovery.email')}</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@example.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  required
                  disabled={recoveryLoading}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('recovery.code')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  required
                  disabled={recoveryLoading}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('recovery.newPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={recoveryLoading}
                />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={recoveryLoading}>
                {recoveryLoading ? t('recovery.submitting') : t('recovery.submit')}
              </button>
            </form>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color, #e5e7eb)', margin: '20px 0' }} />

            {/* 一般メンバー向けの案内 */}
            <div style={{
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text-muted, #9ca3af)',
              marginBottom: '20px'
            }}>
              <strong style={{ color: 'var(--text-primary, #ffffff)', display: 'block', marginBottom: '4px' }}>
                {t('recovery.memberNoticeTitle')}
              </strong>
              {t('recovery.memberNoticeText')}
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => {
                setShowRecovery(false);
                setRecoveryError(null);
                setRecoverySuccess(null);
              }}
              disabled={recoveryLoading}
            >
              {t('recovery.backToLogin')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="setup-container" style={{ position: 'relative' }}>
        {renderLangSelector()}
        <div className="setup-card">
          <h2 className="setup-title">{t('login.title')}</h2>
          <p className="setup-subtitle">{t('login.subtitle')}</p>

          {loginError && <div className="alert-error">{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">{t('login.email')}</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loginLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('login.password')}</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginLoading}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loginLoading}>
              {loginLoading ? t('login.loading') : t('login.submit')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button
              onClick={() => {
                setShowRecovery(true);
                setRecoveryEmail(email); // 入力済みのメールを引き継ぐ
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-link, #4f46e5)',
                cursor: 'pointer',
                fontSize: '13px',
                textDecoration: 'underline'
              }}
            >
              {t('login.forgotPassword')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 9. 通常チャット画面の表示
  return (
    <ChatPage
      currentUser={session}
      initialWorkspaceId={session.workspaceId}
      initialChannelId={session.defaultChannelId}
      onLogout={handleLogout}
      onUpdateUser={handleUpdateSession}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
