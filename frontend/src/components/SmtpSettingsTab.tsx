import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertTriangle, Loader, Trash2, Send } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName?: string;
}

export const SmtpSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [host, setHost] = useState('');
  const [port, setPort] = useState('465');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromName, setFromName] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);

  // 接続テスト用
  const [testRecipient, setTestRecipient] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 既存設定の読み込み
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await apiClient.get<{ settings: SmtpSettings | null }>('/api/settings/smtp');
        if (res && res.settings) {
          setHost(res.settings.host);
          setPort(res.settings.port.toString());
          setUser(res.settings.user);
          setPass(res.settings.pass);
          setFromName(res.settings.fromName || '');
          setHasSettings(true);
          
          // テスト送信の宛先の初期値に設定者自身のメアドを入れておく
          setTestRecipient(res.settings.user);
        } else {
          setHasSettings(false);
        }
      } catch (err) {
        console.error('Failed to load SMTP settings:', err);
      } finally {
        setFetching(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/settings/smtp', {
        host,
        port: parseInt(port, 10),
        user,
        pass,
        fromName,
      });

      if (res.success) {
        setMessage({ type: 'success', text: isEn ? 'SMTP settings saved.' : 'SMTP設定を保存しました。' });
        setHasSettings(true);
        // パスワード入力フィールドを伏せ字状態に
        setPass('********');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || (isEn ? 'Failed to save SMTP settings.' : 'SMTP設定の保存に失敗しました。') });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmMsg = isEn 
      ? 'Are you sure you want to delete SMTP settings? This will disable email functions (invites, notifications, etc.).' 
      : 'SMTP設定を削除しますか？これによりメール送信機能（招待・通知等）が無効になります。';
    if (!confirm(confirmMsg)) return;

    setMessage(null);
    setLoading(true);

    try {
      const res = await apiClient.delete<{ success: boolean }>('/api/settings/smtp');
      if (res.success) {
        setHost('');
        setPort('465');
        setUser('');
        setPass('');
        setFromName('');
        setHasSettings(false);
        setMessage({ type: 'success', text: isEn ? 'SMTP settings cleared. Email delivery is now disabled.' : 'SMTP設定をクリアしました。メール送信は無効になりました。' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || (isEn ? 'Failed to delete settings.' : '設定の削除に失敗しました。') });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/settings/smtp/test', {
        host,
        port: parseInt(port, 10),
        user,
        pass,
        fromName,
        to: testRecipient.trim(),
      });

      if (res.success) {
        setTestResult({ success: true, message: isEn ? 'Test email sent successfully! Please check your inbox.' : 'テストメールの送信に成功しました！受信箱をご確認ください。' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || (isEn ? 'Failed to send. Please check your connection settings.' : '送信に失敗しました。接続設定を確認してください。') });
    } finally {
      setTestLoading(false);
    }
  };

  if (fetching) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div className="settings-form-wrapper" style={{ gap: '20px' }}>
      
      {/* 警告バナー: 未設定時 */}
      {!hasSettings && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          borderLeft: '4px solid #f59e0b',
          padding: '15px',
          borderRadius: '4px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          color: 'var(--text-warning, #d97706)',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            {isEn ? (
              <>
                <strong>[Email features are disabled]</strong><br />
                SMTP configuration has not been set up. The following features are currently unavailable:<br />
                ・Automatic delivery of invitation emails when inviting new members<br />
                ・Email notifications for offline mentions/DMs<br />
                ・Two-factor authentication (MFA) / Login alerts for enhanced security<br />
                Please configure your SMTP server details to start using email features.
              </>
            ) : (
              <>
                <strong>【メール機能は無効です】</strong><br />
                現在、メール送信設定（SMTP）が行われていません。この状態では以下の機能を利用できません。<br />
                ・新規メンバー招待時の「招待メール」の自動配信<br />
                ・オフライン時のメンション/DMの「メール通知」<br />
                ・セキュリティ向上のための「2段階認証 (MFA) / ログイン通知」<br />
                本格的に運用を開始する場合は、自身のメールサーバー（SMTP）情報を設定してください。
              </>
            )}
          </div>
        </div>
      )}

      {/* 成功バナー: 設定済み時 */}
      {hasSettings && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderLeft: '4px solid #10b981',
          padding: '12px 15px',
          borderRadius: '4px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          color: '#10b981',
          fontSize: '13px'
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            {isEn ? (
              <>
                <strong>Email features are enabled.</strong> Invitation emails and system notifications will be sent normally.
              </>
            ) : (
              <>
                <strong>メール送信機能は有効です。</strong> 招待メールやシステム通知が正常に配信されます。
              </>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className={message.type === 'success' ? 'alert-success' : 'alert-error'} style={{
          padding: '10px 15px',
          borderRadius: '4px',
          fontSize: '13px',
          marginBottom: '10px'
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* 左側: SMTPサーバー設定 */}
        <form onSubmit={handleSave} className="settings-form" style={{ flex: '1 1 320px', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            {isEn ? 'SMTP Server Connection Info' : 'SMTPサーバー接続情報'}
          </h3>

          <div className="form-group">
            <label>{isEn ? 'SMTP Host' : 'SMTPホスト'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="smtp.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{isEn ? 'Port Number' : 'ポート番号'}</label>
              <input
                type="number"
                className="form-input"
                placeholder="465"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>{isEn ? 'Encryption Method' : '暗号化方式'}</label>
              <select className="form-input" value={port === '465' ? 'ssl' : 'other'} onChange={(e) => setPort(e.target.value === 'ssl' ? '465' : '587')} disabled={loading}>
                <option value="ssl">{isEn ? 'SSL/TLS (Recommended: Port 465)' : 'SSL/TLS (推奨: ポート465)'}</option>
                <option value="other">{isEn ? 'Other (Port 587, etc.)' : 'その他 (ポート587等)'}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{isEn ? 'Username (SMTP Auth)' : 'ユーザー名 (SMTP Auth)'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="user@example.com"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>{isEn ? 'Password / App Password' : 'パスワード / アプリパスワード'}</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>{isEn ? 'Sender Display Name (Optional)' : '送信者表示名 (任意)'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="Cospace Notification"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" className="submit-btn" style={{ flex: 1, margin: 0 }} disabled={loading}>
              {loading ? (isEn ? 'Saving...' : '保存中...') : (isEn ? 'Save Settings' : '設定を保存')}
            </button>
            {hasSettings && (
              <button
                type="button"
                onClick={handleDelete}
                className="danger-btn"
                style={{ width: 'auto', padding: '0 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', margin: 0 }}
                disabled={loading}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </form>

        {/* 右側: 接続テスト送信 */}
        <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            {isEn ? 'Connection Test' : '接続テスト'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {isEn ? 'Sends a test email using the settings entered. You can test before saving.' : '設定された情報を使用して、テストメールを送信します。保存前に入力した状態でもテスト送信が可能です。'}
          </p>

          <form onSubmit={handleTestSend} className="settings-form" style={{ gap: '12px' }}>
            <div className="form-group">
              <label>{isEn ? 'Test Recipient Email Address' : 'テスト送信先メールアドレス'}</label>
              <input
                type="email"
                className="form-input"
                placeholder="test@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                required
                disabled={testLoading}
              />
            </div>
            
            <button type="submit" className="btn btn-secondary" style={{ width: '100%', gap: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} disabled={testLoading || !host || !user || !pass}>
              {testLoading ? (
                <Loader className="animate-spin" size={14} />
              ) : (
                <Send size={14} />
              )}
              <span>{testLoading ? (isEn ? 'Sending test...' : 'テストメール送信中...') : (isEn ? 'Send Test Email' : 'テストメールを送信')}</span>
            </button>
          </form>

          {testResult && (
            <div style={{
              background: testResult.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
              border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.5',
              color: testResult.success ? '#10b981' : '#ef4444'
            }}>
              {testResult.message}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
