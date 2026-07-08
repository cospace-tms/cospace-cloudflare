import React, { useState, useEffect } from 'react';
import { Edit2, Eye, Save, X, Maximize2, Minimize2, List, Menu } from 'lucide-react';
import { parseMarkdownToHtml, extractTocFromMarkdown, TocItem } from '../utils/markdown';
import { useLanguage } from '../utils/i18n';

interface DocumentPanelProps {
  title: string;
  initialValue: string;
  onSave: (text: string) => Promise<void>;
  onClose?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  onMenuClick?: () => void;
  type?: 'workspace' | 'chat';
}

export const DocumentPanel: React.FC<DocumentPanelProps> = ({
  title,
  initialValue,
  onSave,
  onClose,
  onToggleFullScreen,
  isFullScreen,
  onMenuClick,
  type = 'workspace',
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [markdown, setMarkdown] = useState(initialValue);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('cospace_toc_open');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleToc = () => {
    setIsTocOpen((prev) => {
      const next = !prev;
      localStorage.setItem('cospace_toc_open', String(next));
      return next;
    });
  };

  useEffect(() => {
    setMarkdown(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setToc(extractTocFromMarkdown(markdown));
  }, [markdown]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(markdown);
      setMode('view');
    } catch (err: any) {
      alert((t('error') === 'Error' ? 'Failed to save document: ' : 'ドキュメントの保存に失敗しました: ') + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMarkdown(initialValue);
    setMode('view');
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minWidth: 0 }}>
      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {/* 上部：ドキュメントヘッダー（横幅全体） - type が workspace のときのみ表示 */}
        {type === 'workspace' && (
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              {onMenuClick && (
                <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                  <Menu size={20} />
                </button>
              )}
              <h1 className="channel-info-title" style={{ margin: 0 }}>{title}</h1>
            </div>
          </div>
        )}

        {/* 下部：目次と本文の横並びコンテンツ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* 左：目次（TOC） */}
          <div className={`document-toc ${isTocOpen ? '' : 'collapsed'}`}>
            <div className="document-toc-title">{t('error') === 'Error' ? 'Table of Contents' : '目次'}</div>
            {toc.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('error') === 'Error' ? 'No headings.' : '見出しがありません。'}
              </div>
            ) : (
              <ul className="document-toc-list">
                {toc.map((item) => (
                  <li
                    key={item.id}
                    className={`document-toc-item level-${Math.min(item.level, 3)}`}
                    onClick={() => scrollToHeading(item.id)}
                    title={item.text}
                  >
                    {item.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 右：本文コンテンツ領域とフローティングアクション */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            
            {/* フローティングアクションパネル */}
            <div 
              className="document-floating-actions"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                background: 'var(--bg-panel, rgba(30, 30, 46, 0.85))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid var(--border-light)',
                padding: '8px',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                transition: 'opacity 0.2s ease',
                opacity: 0.8,
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
            >
              {mode === 'view' ? (
                <>
                  {/* 1. 目次トグルボタン */}
                  <button
                    onClick={handleToggleToc}
                    title={isTocOpen ? (t('error') === 'Error' ? 'Close table of contents' : '目次を閉じる') : (t('error') === 'Error' ? 'Open table of contents' : '目次を開く')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isTocOpen ? 'var(--bg-active, rgba(255, 255, 255, 0.05))' : 'transparent',
                      border: 'none',
                      color: isTocOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <List size={16} />
                  </button>

                  {/* 縦配置用の区切り線 */}
                  <div style={{ height: '1px', width: '16px', background: 'var(--border-light)', margin: '2px 0' }} />

                  {/* 2. 編集ボタン */}
                  <button
                    onClick={() => setMode('edit')}
                    title={t('error') === 'Error' ? 'Edit document' : 'ドキュメントを編集'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Edit2 size={16} />
                  </button>

                  {/* 3. 全画面ボタン */}
                  {onToggleFullScreen && (
                    <button
                      onClick={onToggleFullScreen}
                      title={isFullScreen ? (t('error') === 'Error' ? 'Exit fullscreen' : '通常表示に戻す') : (t('error') === 'Error' ? 'Enter fullscreen' : '全画面表示にする')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                  )}

                  {/* 4. 閉じるボタン */}
                  {onClose && (
                    <button
                      onClick={onClose}
                      title={t('workspace.close')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <X size={16} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* 保存ボタン */}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    title={saving ? (t('error') === 'Error' ? 'Saving...' : '保存中...') : t('save')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      color: '#fff',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Save size={16} />
                  </button>

                  {/* キャンセルボタン */}
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    title={t('error') === 'Error' ? 'Cancel changes' : '変更をキャンセル'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg-active, rgba(255, 255, 255, 0.05))',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-muted)',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-panel-hover, rgba(255, 255, 255, 0.1))'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))'}
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>

            {/* 本文コンテンツ */}
            <div className="document-body">
              {mode === 'view' ? (
                <div
                  className="document-preview-content"
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdownToHtml(markdown) || `<em style="color: var(--text-muted);">${t('error') === 'Error' ? 'No document has been created yet. You can create one using the "Edit" button.' : 'ドキュメントがまだ作成されていません。「編集」ボタンから作成できます。'}</em>`
                  }}
                />
              ) : (
                <textarea
                  className="document-editor-textarea"
                  placeholder={t('error') === 'Error' ? `Write document in Markdown.

# Overview
This is the document for this channel.

## Task List
- [ ] Set goals
- [x] Complete design` : `マークダウンでドキュメントを記述してください。

# 概要
これはこのチャンネルのドキュメントです。

## タスクリスト
- [ ] 目標の設定
- [x] 設計の完了`}
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  disabled={saving}
                />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
