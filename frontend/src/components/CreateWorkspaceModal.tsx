import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (name: string) => Promise<void>;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreateWorkspace,
}) => {
  const { t } = useLanguage();
  const [workspaceName, setWorkspaceName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateWorkspace(workspaceName.trim());
      setWorkspaceName('');
      onClose();
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to create workspace: ' : 'ワークスペースの作成に失敗しました: ') + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" style={{ maxWidth: '440px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('error') === 'Error' ? 'Create New Workspace' : 'ワークスペースを新規作成'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="settings-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">{t('setup.workspaceName')}</label>
              <input
                type="text"
                placeholder={t('error') === 'Error' ? "e.g., Test Workspace" : "例: テストワークスペース"}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="form-input"
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-light)' }}>
            <button type="button" className="close-btn" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.05)' }} disabled={submitting}>
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="submit-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'unset' }}
              disabled={submitting || !workspaceName.trim()}
            >
              <Plus size={16} />
              <span>{submitting ? (t('error') === 'Error' ? 'Creating...' : '作成中...') : (t('error') === 'Error' ? 'Create' : '作成する')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
