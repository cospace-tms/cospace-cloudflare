import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Trash2, Download, Eye, Lock, Unlock, FileText, Image, Film, File, Search, Plus, Menu, ChevronRight, Maximize2, Minimize2, X, Loader } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface MediaFile {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  message_id: string | null;
  uploader_id: string;
  file_name: string;
  object_key: string;
  file_size: number;
  content_type: string;
  is_private: number;
  created_at: string;
  uploader_name: string | null;
  channel_name: string | null;
}

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  type?: string;
}

interface MediaLibraryAreaProps {
  workspaceId: string | null;
  currentUserId: string;
  currentUserRole: 'owner' | 'group_admin' | 'member' | 'guest';
  channels: Channel[];
  onMenuClick?: () => void;
  isChatMode?: boolean;
  onClose?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  activeChannelId?: string | null;
}

export const MediaLibraryArea: React.FC<MediaLibraryAreaProps> = ({
  workspaceId,
  currentUserId,
  currentUserRole,
  channels,
  onMenuClick,
  isChatMode = false,
  onClose,
  onToggleFullScreen,
  isFullScreen = false,
  activeChannelId,
}) => {
  const { t } = useLanguage();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フィルタ状態
  const [selectedType, setSelectedType] = useState<'all' | 'image' | 'video' | 'document' | 'other'>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // アップロード用状態
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadChannelId, setUploadChannelId] = useState<string>('workspace');
  const [uploadIsPrivate, setUploadIsPrivate] = useState<boolean>(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // プレビューモーダル
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  
  // チャットモードでのファイルアップロードレフ・処理
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);
      if (activeChannelId) {
        formData.append('channelId', activeChannelId);
      }

      const data = await apiClient.post<{ success: boolean; error?: string }>(
        '/api/files/upload',
        formData
      );

      if (data.success) {
        fetchMedia();
      } else {
        setError(data.error || (t('error') === 'Error' ? 'Failed to upload file' : 'ファイルのアップロードに失敗しました'));
      }
    } catch (err: any) {
      setError(err.message || (t('error') === 'Error' ? 'Upload error occurred' : 'アップロードエラーが発生しました'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ロール判定
  const isOwner = currentUserRole === 'owner';
  const isGroupAdmin = currentUserRole === 'group_admin';

  // メディア一覧取得
  const fetchMedia = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        workspaceId,
      };
      if (selectedType !== 'all') {
        params.fileType = selectedType;
      }
      
      // チャットモードかつ特定のチャンネルIDがある場合、チャンネルで絞り込み
      if (isChatMode && activeChannelId) {
        params.channelId = activeChannelId;
      } else if (selectedChannelId !== 'all') {
        params.channelId = selectedChannelId;
      }

      const response = await apiClient.get<{ success: boolean; files: MediaFile[] }>(
        '/api/media',
        params
      );

      if (response.success && Array.isArray(response.files)) {
        setFiles(response.files);
      } else {
        setError(t('error') === 'Error' ? 'Failed to fetch media' : 'メディアの取得に失敗しました');
      }
    } catch (err: any) {
      setError(err.message || (t('error') === 'Error' ? 'An error occurred' : 'エラーが発生しました'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedType, selectedChannelId, isChatMode, activeChannelId, t]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // アップロード処理
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !uploadFile) return;

    setUploading(true);
    setUploadSuccess(false);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('workspaceId', workspaceId);
      
      if (uploadChannelId !== 'workspace') {
        formData.append('channelId', uploadChannelId);
      } else {
        formData.append('isPrivate', uploadIsPrivate ? '1' : '0');
      }

      const data = await apiClient.post<{ success: boolean; error?: string }>(
        '/api/files/upload',
        formData
      );

      if (data.success) {
        setUploadSuccess(true);
        setUploadFile(null);
        // ファイルインプットのリセット
        const fileInput = document.getElementById('media-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchMedia();
      } else {
        setError(data.error || (t('error') === 'Error' ? 'Failed to upload file' : 'ファイルのアップロードに失敗しました'));
      }
    } catch (err: any) {
      setError(err.message || (t('error') === 'Error' ? 'Upload error occurred' : 'アップロードエラーが発生しました'));
    } finally {
      setUploading(false);
    }
  };

  // ファイル削除処理
  const handleDelete = async (fileId: string) => {
    if (!window.confirm(t('error') === 'Error' 
      ? 'Are you sure you want to permanently delete this file? (If attached to a chat, it will no longer be accessible there either)' 
      : 'このファイルを永久に削除してもよろしいですか？（チャットに添付されている場合は、チャット上からもアクセスできなくなります）')) {
      return;
    }

    try {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(
        `/api/files/${fileId}`
      );
      if (response.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (previewFile?.id === fileId) {
          setPreviewFile(null);
        }
      } else {
        alert(t('error') === 'Error' ? 'Failed to delete file' : 'ファイルの削除に失敗しました');
      }
    } catch (err: any) {
      alert(err.message || (t('error') === 'Error' ? 'Delete error occurred' : '削除エラーが発生しました'));
    }
  };

  // ファイルサイズフォーマット
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // ファイルアイコン決定
  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image size={32} className="text-blue" />;
    if (contentType.startsWith('video/')) return <Film size={32} className="text-green" />;
    if (contentType.includes('pdf') || contentType.includes('text/')) return <FileText size={32} className="text-yellow" />;
    return <File size={32} className="text-gray" />;
  };

  // 検索フィルタ適用後のリスト
  const filteredFiles = files.filter((file) => {
    return file.file_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isEn = t('error') === 'Error';

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minWidth: 0, position: 'relative' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {/* ヘッダーセクション - チャットモード以外で表示 */}
        {!isChatMode && (
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              {onMenuClick && (
                <button className="mobile-menu-trigger" onClick={onMenuClick} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                  <Menu size={20} />
                </button>
              )}
              <h1 className="channel-info-title" style={{ margin: 0 }}>{t('sidebar.mediaLibrary')}</h1>
              <span className="channel-info-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('error') === 'Error' ? 'Manage shared and private files in the workspace.' : 'ワークスペース内の共有・プライベートファイルを管理します。'}
              </span>
            </div>
          </div>
        )}

        {/* チャットモード用フローティングアクション */}
        {isChatMode && (
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
            {/* 1. アップロードボタン */}
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
        )}

        {/* メインコンテンツ領域（パディング付きでスクロール可能に） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto', minHeight: 0 }}>

      <div className="media-library-grid" style={{ display: 'grid', gridTemplateColumns: isChatMode ? '1fr' : '1fr 320px', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* メイン一覧エリア */}
        <div className="media-library-list-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* コントロール・フィルターバー */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* タイプフィルタータブ */}
            <div className="tab-group" style={{ display: 'flex', background: 'var(--bg-active)', borderRadius: '8px', padding: '3px' }}>
              {(['all', 'image', 'video', 'document', 'other'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedType === type ? 'var(--bg-sidebar)' : 'transparent',
                    color: selectedType === type ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: selectedType === type ? 'bold' : 'normal',
                    textTransform: 'capitalize'
                  }}
                >
                  {type === 'all' ? (isEn ? 'All' : 'すべて') : type === 'image' ? (isEn ? 'Image' : '画像') : type === 'video' ? (isEn ? 'Video' : '動画') : type === 'document' ? (isEn ? 'Document' : '書類') : (isEn ? 'Other' : 'その他')}
                </button>
              ))}
            </div>

            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-sidebar)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="all">{t('error') === 'Error' ? 'All Channels' : 'すべてのチャンネル'}</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.type === 'dm' ? `DM: ${ch.name}` : `# ${ch.name}`}
                </option>
              ))}
            </select>

            {/* 検索バー */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={t('error') === 'Error' ? 'Search by file name...' : 'ファイル名で検索...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-sidebar)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

          {/* メディアカードグリッド */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)' }}>
                {t('loading')}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '200px', border: '2px dashed var(--border-light)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                <File size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <span>{t('error') === 'Error' ? 'No matching files found' : '該当するファイルが見つかりません'}</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {filteredFiles.map((file) => {
                  const isImage = file.content_type.startsWith('image/');
                  const isVideo = file.content_type.startsWith('video/');
                  const downloadUrl = `http://127.0.0.1:8787/api/files/download/${file.object_key}`;

                  // 削除ボタン表示条件
                  const canDelete = file.uploader_id === currentUserId || isOwner || isGroupAdmin;

                  return (
                    <div
                      key={file.id}
                      className="media-card"
                      style={{
                        background: 'var(--bg-sidebar)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer'
                      }}
                      onClick={() => setPreviewFile(file)}
                    >
                      {/* サムネイルプレビュー領域 */}
                      <div style={{ height: '130px', background: '#1e1e24', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                        {isImage ? (
                          <img
                            src={downloadUrl}
                            alt={file.file_name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                          />
                        ) : isVideo ? (
                          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Film size={40} style={{ color: '#fff', opacity: 0.8 }} />
                            <span style={{ position: 'absolute', bottom: '6px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }}>{t('error') === 'Error' ? 'Video' : '動画'}</span>
                          </div>
                        ) : (
                          getFileIcon(file.content_type)
                        )}

                        {/* プライベートバッジ */}
                        {file.is_private === 1 && (
                          <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', display: 'flex', padding: '4px' }} title={t('error') === 'Error' ? 'Private' : 'プライベート設定'}>
                            <Lock size={12} />
                          </div>
                        )}
                      </div>

                      {/* ファイル情報 */}
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.file_name}>
                          {file.file_name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {formatBytes(file.file_size)}
                        </span>
                        <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                            by {file.uploader_name || (t('error') === 'Error' ? 'Unknown' : '不明')}
                          </span>
                          
                          {/* 各種操作 */}
                          <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                            <a
                              href={downloadUrl}
                              download={file.file_name}
                              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                              title={t('error') === 'Error' ? 'Download' : 'ダウンロード'}
                            >
                              <Download size={14} />
                            </a>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(file.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: 0 }}
                                title={t('delete')}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* モバイル用アップロードトグルボタン（PC時は CSS で非表示） */}
        <button
          className="media-upload-toggle-btn"
          onClick={() => setShowUpload(!showUpload)}
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={16} />
            <span>{t('error') === 'Error' ? 'Upload File' : 'ファイルをアップロード'}</span>
          </div>
          {showUpload ? <ChevronRight size={16} style={{ transform: 'rotate(90deg)', transition: 'transform 0.2s' }} /> : <ChevronRight size={16} style={{ transition: 'transform 0.2s' }} />}
        </button>

        {/* 右側：新規アップロードパネル - チャットモード以外で表示 */}
        {!isChatMode && (
          <div className={`media-library-upload-panel ${showUpload ? 'show' : ''}`} style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={16} />
              {t('error') === 'Error' ? 'New Upload' : '新規アップロード'}
            </h2>

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ファイル選択領域 */}
              <div
                style={{
                  border: '2px dashed var(--border-light)',
                  borderRadius: '8px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-active)'
                }}
                onClick={() => document.getElementById('media-file-input')?.click()}
              >
                <input
                  type="file"
                  id="media-file-input"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setUploadFile(e.target.files[0]);
                      setUploadSuccess(false);
                    }
                  }}
                />
                <Upload size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px auto', display: 'block' }} />
                {uploadFile ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {uploadFile.name}
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('error') === 'Error' ? 'Click to select file' : 'クリックしてファイルを選択'}</span>
                )}
              </div>

              {/* 共有範囲（アップ先） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{t('error') === 'Error' ? 'Share Range' : '共有範囲'}</label>
                <select
                  value={uploadChannelId}
                  onChange={(e) => setUploadChannelId(e.target.value)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-sidebar)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="workspace">{t('error') === 'Error' ? 'Entire Workspace' : 'ワークスペース全体'}</option>
                  {channels.filter(c => c.type !== 'dm').map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {t('error') === 'Error' ? `Channel: #${ch.name}` : `チャンネル: #${ch.name}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* ワークスペース全体の場合のプライベート設定 */}
              {uploadChannelId === 'workspace' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="upload-is-private"
                    checked={uploadIsPrivate}
                    onChange={(e) => setUploadIsPrivate(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="upload-is-private" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {uploadIsPrivate ? <Lock size={14} /> : <Unlock size={14} />}
                    <span>{t('error') === 'Error' ? 'Only for me and admins (Private)' : '自分と管理者のみに開示 (プライベート)'}</span>
                  </label>
                </div>
              )}

              {/* 送信ボタン */}
              <button
                type="submit"
                disabled={!uploadFile || uploading}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (!uploadFile || uploading) ? 'var(--border-light)' : 'var(--primary-color)',
                  color: '#fff',
                  fontWeight: 'bold',
                  cursor: (!uploadFile || uploading) ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {uploading ? (t('error') === 'Error' ? 'Uploading...' : 'アップロード中...') : (t('error') === 'Error' ? 'Upload' : 'アップロードする')}
              </button>

              {uploadSuccess && (
                <div style={{ color: 'var(--accent-success)', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                  {t('error') === 'Error' ? 'Upload complete!' : 'アップロード完了しました！'}
                </div>
              )}
              
              {error && (
                <div style={{ color: 'var(--accent-danger)', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                  {error}
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* プレビュー詳細モーダル */}
      {previewFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '24px'
          }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{
              background: 'var(--bg-sidebar)',
              borderRadius: '16px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{previewFile.file_name}</span>
                {previewFile.is_private === 1 && <Lock size={14} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* モーダルコンテンツプレビュー */}
            <div style={{ flex: 1, background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', overflow: 'hidden', position: 'relative' }}>
              {previewFile.content_type.startsWith('image/') ? (
                <img
                  src={`http://127.0.0.1:8787/api/files/download/${previewFile.object_key}`}
                  alt={previewFile.file_name}
                  style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
                />
              ) : previewFile.content_type.startsWith('video/') ? (
                <video
                  src={`http://127.0.0.1:8787/api/files/download/${previewFile.object_key}`}
                  controls
                  style={{ maxWidth: '100%', maxHeight: '500px' }}
                />
              ) : (
                <div style={{ color: '#fff', textAlign: 'center' }}>
                  {getFileIcon(previewFile.content_type)}
                  <div style={{ marginTop: '16px', fontSize: '14px' }}>{t('error') === 'Error' ? 'This file format cannot be previewed.' : 'このファイル形式はプレビューできません。'}</div>
                </div>
              )}
            </div>

            {/* モーダルフッター情報 */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{t('error') === 'Error' ? `Size: ${formatBytes(previewFile.file_size)}` : `サイズ: ${formatBytes(previewFile.file_size)}`}</span>
                <span>{(t('error') === 'Error' ? 'Uploaded: ' : 'アップロード日: ') + new Date(previewFile.created_at).toLocaleString(t('error') === 'Error' ? 'en-US' : 'ja-JP')}</span>
                <span>{t('error') === 'Error' ? ('Shared with: ' + (previewFile.channel_name ? `#${previewFile.channel_name}` : (previewFile.is_private === 1 ? 'Only me and admins (Private)' : 'Entire Workspace'))) : ('共有先: ' + (previewFile.channel_name ? `#${previewFile.channel_name}` : (previewFile.is_private === 1 ? '自分と管理者のみ (非公開)' : 'ワークスペース全体')))}</span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <a
                  href={`http://127.0.0.1:8787/api/files/download/${previewFile.object_key}`}
                  download={previewFile.file_name}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  {t('error') === 'Error' ? 'Download' : 'ダウンロード'}
                </a>
                {(previewFile.uploader_id === currentUserId || isOwner || isGroupAdmin) && (
                  <button
                    onClick={() => handleDelete(previewFile.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'var(--accent-danger)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Trash2 size={14} />
                    {t('delete')}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};
