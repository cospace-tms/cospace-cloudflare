import React, { useState } from 'react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface SetupPageProps {
  onSetupComplete: (data: {
    userId: string;
    workspaceId: string;
    defaultChannelId: string;
    userEmail: string;
    displayName: string;
    token?: string;
    language?: string;
  }) => void;
}

export const SetupPage: React.FC<SetupPageProps> = ({ onSetupComplete }) => {
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [setupLang, setSetupLang] = useState<'ja' | 'en'>(language);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // リカバリーコード表示用の状態
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!email || !password || !displayName || !workspaceName) {
      setError(t('setup.errorRequired'));
      return;
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /[^A-Za-z0-9]/.test(password);

    if (password.length < 8 || !(hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas)) {
      setError(t('setup.errorPassword'));
      return;
    }

    setLoading(true);
    try {
      // セットアップAPIの実行
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: {
          userId: string;
          workspaceId: string;
          defaultChannelId: string;
          token?: string;
          recoveryCode?: string;
        };
      }>('/api/setup/register', {
        email,
        password,
        displayName,
        workspaceName,
        language: setupLang,
      });

      if (response.success && response.data) {
        if (response.data.recoveryCode) {
          // リカバリーコード表示画面を挟む
          setRecoveryCode(response.data.recoveryCode);
          setSetupData({
            userId: response.data.userId,
            workspaceId: response.data.workspaceId,
            defaultChannelId: response.data.defaultChannelId,
            userEmail: email,
            displayName,
            token: response.data.token,
            language: setupLang,
          });
        } else {
          // 万が一リカバリーコードがない場合は即座に完了
          onSetupComplete({
            userId: response.data.userId,
            workspaceId: response.data.workspaceId,
            defaultChannelId: response.data.defaultChannelId,
            userEmail: email,
            displayName,
            token: response.data.token,
            language: setupLang,
          });
        }
      } else {
        setError(t('error') === 'Error' ? 'Setup failed.' : 'セットアップに失敗しました。');
      }
    } catch (err: any) {
      console.error('Setup failed:', err);
      setError(err.message || (t('error') === 'Error' ? 'An error occurred during setup.' : 'セットアップの実行中にエラーが発生しました。'));
    } finally {
      setLoading(false);
    }
  };

  // リカバリーコードのダウンロード
  const downloadRecoveryCode = () => {
    if (!recoveryCode) return;
    const isEn = t('error') === 'Error';
    const element = document.createElement("a");
    const file = new Blob([
      `========================================\r\n`,
      isEn ? `  Cospace Administrator Recovery Code\r\n` : `  Cospace 管理者 リカバリーコード\r\n`,
      `  Keep this file SECURE and CONFIDENTIAL!\r\n`,
      `========================================\r\n\r\n`,
      `Email Address: ${email}\r\n`,
      `Recovery Code: ${recoveryCode}\r\n\r\n`,
      isEn 
        ? `* This recovery code is the only key to reset your account if you forget your password.\r\n* Since email is not configured in the current deploy environment, you will not receive reset emails.\r\n  Losing this code means you will NOT be able to recover your account.\r\n`
        : `※このリカバリーコードは、パスワードを忘れた際にアカウントを再設定するための唯一のキーです。\r\n※現在メール機能が未設定のデプロイ環境では、パスワードリセット用のメールが届かないため、\r\n  このコードを紛失するとアカウントを復旧できなくなります。\r\n`
    ], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = "cospace_recovery_code.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // リカバリーコード提示画面
  if (recoveryCode) {
    return (
      <div className="setup-container">
        <div className="setup-card" style={{ maxWidth: '520px', textAlign: 'center' }}>
          <h2 className="setup-title" style={{ color: 'var(--text-danger, #ef4444)' }}>{t('setup.recoveryTitle')}</h2>
          <p className="setup-subtitle" style={{ marginBottom: '20px' }}>
            {t('setup.recoverySubtitle')}
          </p>

          <div style={{
            background: 'var(--bg-secondary, #f3f4f6)',
            border: '2px dashed var(--border-color, #e5e7eb)',
            borderRadius: '8px',
            padding: '20px',
            fontSize: '22px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            fontWeight: 'bold',
            color: 'var(--text-primary, #1f2937)',
            margin: '20px 0',
            userSelect: 'all',
            wordBreak: 'break-all'
          }}>
            {recoveryCode}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '25px' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(recoveryCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              {copied ? t('setup.copied') : t('setup.copyCode')}
            </button>
            <button
              onClick={downloadRecoveryCode}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              {t('setup.saveFile')}
            </button>
          </div>

          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderLeft: '4px solid #f59e0b',
            padding: '15px',
            borderRadius: '4px',
            textAlign: 'left',
            fontSize: '13px',
            color: 'var(--text-warning, #d97706)',
            lineHeight: '1.6',
            marginBottom: '25px'
          }}>
            <strong>{t('setup.importantNotice')}</strong><br />
            {t('setup.noticeText')}
          </div>

          <button
            onClick={() => {
              if (setupData) {
                onSetupComplete(setupData);
              }
            }}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            {t('setup.startApp')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container">
      <div className="setup-card">
        <h2 className="setup-title">{t('setup.title')}</h2>
        <p className="setup-subtitle">{t('setup.subtitle')}</p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('profile.language')}</label>
            <select
              className="form-input"
              value={setupLang}
              onChange={(e) => {
                const selected = e.target.value as 'ja' | 'en';
                setSetupLang(selected);
                setLanguage(selected);
              }}
              disabled={loading}
            >
              <option value="ja">日本語 (Japanese)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('setup.displayName')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('error') === 'Error' ? "e.g., Admin Taro" : "例: 管理者 太郎"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('setup.email')}</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('setup.password')}</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
              {t('setup.passwordHelp')}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">{t('setup.workspaceName')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('error') === 'Error' ? "e.g., Sample Inc." : "例: 株式会社サンプル"}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('setup.loading') : t('setup.submit')}
          </button>
        </form>
      </div>
    </div>
  );
};
