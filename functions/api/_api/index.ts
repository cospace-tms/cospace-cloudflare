// Authentication & Setup
export { handleLogin, handleChangePassword, handleRefresh, handleLogout, handleVerifyMfa, handleRegister } from "./auth";
export { handleSetupStatus, handleSetupRegister } from "./setup";

// Workspaces
export { handleGetWorkspaces, handleCreateWorkspace, handleUpdateWorkspace, handleDeleteWorkspace } from "./chat/workspace";

// Channels
export { handleGetChannels, handleCreateChannel, handleUpdateChannel, handleDeleteChannel, handleBrowseChannels } from "./chat/channel";

// Messages
export { handleGetMessages, handleCreateMessage, handleGetMessagesGeneral, handleCreateMessageGeneral, handleToggleReaction } from "./chat/message";

// Members & Users
export {
  handleUpdateUser,
  handleGetWorkspaceMembers,
  handleAddWorkspaceMember,
  handleUpdateWorkspaceMember,
  handleDeleteWorkspaceMember,
  handleGetWorkspaceUserRole,
  handleGetGroupMembers,
  handleAddGroupMember,
  handleUpdateGroupMember,
  handleDeleteGroupMember,
  handleGetChannelMembers,
  handleAddChannelMember,
  handleDeleteChannelMember,
  handleGetEmailChangeStatus,
  handleRequestEmailChange,
  handleConfirmEmailChange
} from "./chat/member";

// Groups
export { handleGetGroups, handleCreateGroup, handleUpdateGroup, handleDeleteGroup } from "./chat/group";

// Files
export {
  handleGetPresignedUploadUrl,
  handleGetPresignedDownloadUrl,
  handleDirectUpload,
  handleDirectDownload,
  handleGetMediaLibrary,
  handleDeleteFile
} from "./files";

// Notifications
export { handleGetNotifications, handleReadNotification, handleReadAllNotifications, handleArchiveNotification, handleGetUnreadNotificationsCount } from "./notifications";

// Documents
export { handleGetWorkspaceDocument, handleUpdateWorkspaceDocument, handleGetChannelDocument, handleUpdateChannelDocument } from "./document";

// Recovery & SMTP
export { handleRecovery, handleResetMemberPassword, handleSaveSmtpSettings, handleGetSmtpSettings, handleDeleteSmtpSettings, handleTestSmtpSettings } from "./auth-recovery";

// Activities
export { handleGetActivities } from "./activities";

// Search
export { handleSearchWorkspace } from "./chat/search";

// Emoji
export { handleCreateCustomEmoji, handleGetCustomEmojis, handleDeleteCustomEmoji, handleGetCustomEmojiRaw } from "./chat/emoji";

// Document Locks
export { handleGetDocumentLock, handleAcquireDocumentLock, handleHeartbeatDocumentLock, handleReleaseDocumentLock } from "./document_locks";

// Pins & Stars
export { handlePinMessage, handleUnpinMessage, handleGetPinnedMessages, handleStarChannel, handleUnstarChannel } from "./pins_and_stars";

// Push Notifications
export { handleGetVapidPublicKey, handleSubscribe, handleSendTestPush, handleUnsubscribeAll, handleCheckRegistration } from "./push";
