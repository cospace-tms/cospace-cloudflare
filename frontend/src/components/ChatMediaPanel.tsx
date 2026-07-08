import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Image, FileText, Film, File, Download, Loader, Eye, X, Maximize2, Minimize2, Upload } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface MediaFile {
  id: string;
  file_name: string;
  object_key: string;
  file_size: number;
  content_type: string;
  created_at: string;
  uploader_name?: string;
}

interface ChatMediaPanelProps {
  workspaceId: string | null;
  channelId: string | null;
  onClose?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
}

export const ChatMediaPanel: React.FC<ChatMediaPanelProps> = ({
  workspaceId,
  channelId,
  onClose,
  onToggleFullScreen,
  isFullScreen = false,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId || !channelId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);
      formData.append('channelId', channelId);

      const res = await apiClient.post<{ success: boolean; error?: string }>(
        '/api/files/upload',
        formData
      );

      if (res.success) {
        loadChannelFiles();
      } else {
        alert((isEn ? 'Upload failed: ' : 'アップロードに失敗しました: ') + res.error);
      }
    } catch (err) {
      alert((isEn ? 'Upload failed: ' : 'アップロードに失敗しました: ') + err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadChannelFiles = useCallback(async () => {
    if (!workspaceId || !channelId) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: MediaFile[] }>(
        `/api/media?workspaceId=${workspaceId}&channelId=${channelId}`
      );
      if (res.success && Array.isArray(res.data)) {
        setFiles(res.data);
      }
    } catch (err) {
      console.error('Failed to load channel files:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, channelId]);

  useEffect(() => {
    loadChannelFiles();
  }, [loadChannelFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) {
      return <Image size={16} />;
    } else if (contentType.startsWith('video/')) {
      return <Film size={16} />;
    } else if (contentType.includes('pdf') || contentType.startsWith('text/')) {
      return <FileText size={16} />;
    } else {
      return <File size={16} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', borderLeft: '1px solid var(--border-light)', background: 'var(--bg-main)', position: 'relative' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* パネルヘッダー */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
          {isEn ? 'Channel Media' : 'チャネルメディア'}
        </h3>
      </div>

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
        {/* 1. ファイルアップロードボタン */}
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          title={uploading ? (isEn ? 'Uploading...' : 'アップロード中...') : (isEn ? 'Upload File' : 'ファイルをアップロード')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: uploading ? 'var(--text-muted)' : 'var(--text-primary)',
            padding: '6px',
            borderRadius: '6px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => { if(!uploading) e.currentTarget.style.background = 'var(--bg-active, rgba(255, 255, 255, 0.05))' }}
          onMouseLeave={(e) => { if(!uploading) e.currentTarget.style.background = 'transparent' }}
        >
          {uploading ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
        </button>

        {/* 縦配置用の区切り線 */}
        {(onToggleFullScreen || onClose) && (
          <div style={{ height: '1px', width: '16px', background: 'var(--border-light)', margin: '2px 0' }} />
        )}

        {/* 2. 全画面ボタン */}
        {onToggleFullScreen && (
          <button
            onClick={onToggleFullScreen}
            title={isFullScreen ? (isEn ? 'Exit fullscreen' : '通常表示に戻す') : (isEn ? 'Enter fullscreen' : '全画面表示にする')}
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

        {/* 3. 閉じるボタン */}
        {onClose && (
          <button
            onClick={onClose}
            title={isEn ? 'Close' : '閉じる'}
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
            <X size={16} />
          </button>
        )}
      </div>

      {/* ファイルリスト */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader className="animate-spin" size={18} style={{ margin: '0 auto 8px' }} />
            <span>{isEn ? 'Loading files...' : '読み込み中...'}</span>
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {isEn ? 'No files shared yet.' : '共有されたファイルはありません。'}
          </div>
        ) : (
          files.map((file) => {
            const isImage = file.content_type.startsWith('image/');
            const isVideo = file.content_type.startsWith('video/');
            const downloadUrl = `http://127.0.0.1:8787/api/files/download/${file.object_key}`;

            return (
              <div
                key={file.id}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                {/* サムネイル or アイコン */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {isImage ? (
                      <img
                        src={downloadUrl}
                        alt="thumb"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getFileIcon(file.content_type)
                    )}
                  </div>

                  {/* ファイル詳細 */}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={file.file_name}
                    >
                      {file.file_name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatFileSize(file.file_size)} • {file.uploader_name || 'unknown'}
                    </span>
                  </div>
                </div>

                {/* 操作アクション */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {(isImage || isVideo) && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      style={{
                        padding: '6px',
                        borderRadius: '4px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                      title={isEn ? 'Preview' : 'プレビュー'}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <a
                    href={downloadUrl}
                    download={file.file_name}
                    style={{
                      padding: '6px',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      textDecoration: 'none',
                    }}
                    title={isEn ? 'Download' : 'ダウンロード'}
                  >
                    <Download size={14} />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* プレビューモーダル（画像・動画用） */}
      {previewFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px',
          }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewFile(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <X size={20} />
            </button>
            {previewFile.content_type.startsWith('image/') ? (
              <img
                src={`http://127.0.0.1:8787/api/files/download/${previewFile.object_key}`}
                alt="preview"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            ) : (
              <video
                src={`http://127.0.0.1:8787/api/files/download/${previewFile.object_key}`}
                controls
                autoPlay
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }}
              />
            )}
            <span style={{ color: '#fff', fontSize: '13px', marginTop: '12px', textAlign: 'center', fontWeight: 500 }}>
              {previewFile.file_name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
