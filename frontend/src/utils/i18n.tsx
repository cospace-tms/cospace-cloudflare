import React, { useState } from 'react';

export type Language = 'ja' | 'en';

export const translations = {
  ja: {
    // 共通 / Common
    "save": "保存する",
    "cancel": "キャンセル",
    "edit": "編集",
    "delete": "削除",
    "loading": "読み込み中...",
    "error": "エラー",
    "success": "成功しました",
    "language": "言語",
    "settings": "設定",

    // 接続ステータス
    "connection.checking": "接続ステータスを確認中...",
    "connection.error": "接続エラー",
    "connection.retry": "再試行する",

    // ログイン画面 / Login
    "login.title": "cospace ログイン",
    "login.subtitle": "セットアップ済みのユーザーアカウントでログインします。",
    "login.email": "メールアドレス",
    "login.password": "パスワード",
    "login.submit": "ログイン",
    "login.loading": "ログイン中...",
    "login.forgotPassword": "パスワードを忘れた場合",

    // パスワード再設定 / Password Recovery
    "recovery.title": "パスワードの再設定",
    "recovery.subtitle": "リカバリーコード、または管理者への依頼によるアカウント復旧",
    "recovery.ownerTitle": "最高管理者 (Owner) の復旧",
    "recovery.email": "登録メールアドレス",
    "recovery.code": "リカバリーコード",
    "recovery.newPassword": "新しいパスワード (8文字以上)",
    "recovery.submit": "パスワードを再設定してログイン",
    "recovery.submitting": "再設定中...",
    "recovery.success": "パスワードが正常に更新されました。ログインします...",
    "recovery.memberNoticeTitle": "一般メンバー・ゲストの方へ",
    "recovery.memberNoticeText": "パスワードを忘れた場合は、所属するワークスペースの管理者（オーナー等）に連絡し、一時パスワードの発行を依頼してください。",
    "recovery.backToLogin": "ログイン画面に戻る",

    // セットアップ画面 / Setup Page
    "setup.title": "cospace セットアップ",
    "setup.subtitle": "最初の最高管理者 (Owner) とワークスペースを作成します。",
    "setup.displayName": "表示名 (Display Name)",
    "setup.email": "メールアドレス",
    "setup.password": "パスワード",
    "setup.passwordHelp": "※8文字以上で、英大文字、英小文字、数字、および記号（!@#$%^&* 等）をそれぞれ最低1文字含めてください。",
    "setup.workspaceName": "初期ワークスペース名",
    "setup.submit": "初期セットアップを完了する",
    "setup.loading": "登録中...",
    "setup.errorRequired": "すべてのフィールドを入力してください。",
    "setup.errorPassword": "パスワードは8文字以上で、英大文字、英小文字、数字、および記号（!@#$%^&* など）をそれぞれ最低1文字以上含める必要があります。",
    "setup.recoveryTitle": "⚠️ リカバリーコードの保存",
    "setup.recoverySubtitle": "パスワードを忘れた場合に管理者アカウントを復旧するための唯一のコードです。安全な場所に保存してください。",
    "setup.copyCode": "コードをコピー",
    "setup.copied": "コピーしました！",
    "setup.saveFile": "ファイルで保存",
    "setup.importantNotice": "【重要なお知らせ】",
    "setup.noticeText": "現在、メール送信機能（SMTP）が未設定です。メールサーバーの設定が完了するまでは、このリカバリーコードが管理者パスワードを紛失した際の唯一の復旧手段になります。本格運用を開始する前に、システム設定からメール（SMTP）を設定することを強く推奨します。",
    "setup.startApp": "コードを保存しました - アプリを開始する",

    // サイドバー / Sidebar
    "sidebar.inbox": "受信箱",
    "sidebar.workspaceDoc": "ワークスペースドキュメント",
    "sidebar.mediaLibrary": "メディアライブラリ",
    "sidebar.members": "メンバー管理",
    "sidebar.settings": "設定",
    "sidebar.logout": "ログアウト",
    "sidebar.addWorkspace": "ワークスペースを追加",
    "sidebar.channels": "チャンネル",
    "sidebar.browseChannels": "チャンネルを探す",
    "sidebar.addChannel": "チャンネルを追加",
    "sidebar.dms": "ダイレクトメッセージ",
    "sidebar.startDm": "DMを開始",
    "sidebar.theme": "テーマ切り替え",

    // プロフィール設定 / User Profile Modal
    "profile.title": "プロフィール設定",
    "profile.email": "メールアドレス",
    "profile.emailHelp": "メールアドレスは変更できません。",
    "profile.displayName": "表示名",
    "profile.avatar": "アバター画像",
    "profile.uploadImage": "画像をアップロード",
    "profile.uploading": "アップロード中...",
    "profile.save": "保存する",
    "profile.updateSuccess": "プロフィールを更新しました。",
    "profile.updateFailed": "プロフィールの更新に失敗しました",
    "profile.pwChange": "パスワード変更",
    "profile.currentPw": "現在のパスワード",
    "profile.newPw": "新しいパスワード",
    "profile.newPwHelp": "※8文字以上で、英大文字、英小文字、数字、記号をそれぞれ最低1文字含めてください。",
    "profile.confirmPw": "新しいパスワード（確認）",
    "profile.pwChangeBtn": "パスワードを変更",
    "profile.pwRequired": "すべてのパスワード欄を入力してください。",
    "profile.pwMismatch": "新しいパスワードと確認用パスワードが一致しません。",
    "profile.pwFormatError": "新しいパスワードは8文字以上で、英大文字、英小文字、数字、および記号（!@#$%^&* など）をそれぞれ最低1文字以上含める必要があります。",
    "profile.pwChangeSuccess": "パスワードを変更しました。",
    "profile.pwChangeFailed": "パスワードの変更に失敗しました。",
    "profile.language": "言語設定 (Language)",

    // ワークスペース管理 / Workspace Management
    "workspace.mgmt": "ワークスペース管理",
    "workspace.members": "メンバー管理",
    "workspace.groups": "グループ管理",
    "workspace.statuses": "ステータス設定",
    "workspace.smtp": "メール送信設定",
    "workspace.general": "基本設定",
    "workspace.rename": "名前を変更",
    "workspace.invite": "メンバーを招待",
    "workspace.add": "追加",
    "workspace.role.member": "メンバー",
    "workspace.role.guest": "ゲスト",
    "workspace.role.groupAdmin": "グループ管理者",
    "workspace.role.owner": "管理者(Owner)",
    "workspace.memberList": "所属メンバー",
    "workspace.dangerZone": "危険区域",
    "workspace.deleteText": "ワークスペースを削除すると、紐づくすべてのデータが削除されます。この操作は元に戻せません。",
    "workspace.deleteBtn": "ワークスペースを削除する",
    "workspace.statusTitle": "カスタムステータス設定",
    "workspace.statusHelp": "ビジネスや家庭の運用方法に合わせて、タスク管理（かんばんボード）のステータス列を自由に増減・並び替えできます。",
    "workspace.statusHelp2": "※ステータス名はシステム内でユニークにしてください。",
    "workspace.statusAddPlaceholder": "新しいステータス名（例: レビュー中）",
    "workspace.statusOrderLabel": "設定中のステータス順序（上から順にかんばんボードの左から並びます）",
    "workspace.statusSaveBtn": "ステータス設定を保存",
    "workspace.tempPwIssued": "一時パスワードを発行しました",
    "workspace.tempPwHelp": "ユーザーの新しい一時パスワードです。一度この画面を閉じると再表示できません。必ずコピーしてユーザーに伝えてください。",
    "workspace.copy": "コピー",
    "workspace.close": "閉じる"
  },
  en: {
    // 共通 / Common
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "language": "Language",
    "settings": "Settings",

    // 接続ステータス
    "connection.checking": "Checking connection status...",
    "connection.error": "Connection Error",
    "connection.retry": "Retry",

    // ログイン画面 / Login
    "login.title": "cospace Login",
    "login.subtitle": "Login with your configured user account.",
    "login.email": "Email Address",
    "login.password": "Password",
    "login.submit": "Login",
    "login.loading": "Logging in...",
    "login.forgotPassword": "Forgot your password?",

    // パスワード再設定 / Password Recovery
    "recovery.title": "Reset Password",
    "recovery.subtitle": "Recover your account using a recovery code or by asking an administrator.",
    "recovery.ownerTitle": "Recover Owner Account",
    "recovery.email": "Registered Email Address",
    "recovery.code": "Recovery Code",
    "recovery.newPassword": "New Password (8+ characters)",
    "recovery.submit": "Reset Password & Login",
    "recovery.submitting": "Resetting...",
    "recovery.success": "Password updated successfully. Logging in...",
    "recovery.memberNoticeTitle": "For Members & Guests",
    "recovery.memberNoticeText": "If you forgot your password, please contact your workspace administrator to issue a temporary password.",
    "recovery.backToLogin": "Back to Login",

    // セットアップ画面 / Setup Page
    "setup.title": "cospace Setup",
    "setup.subtitle": "Create the first owner account and workspace.",
    "setup.displayName": "Display Name",
    "setup.email": "Email Address",
    "setup.password": "Password",
    "setup.passwordHelp": "Must be 8+ characters and contain uppercase, lowercase, numbers, and symbols (!@#$%^&*).",
    "setup.workspaceName": "Workspace Name",
    "setup.submit": "Complete Setup",
    "setup.loading": "Registering...",
    "setup.errorRequired": "All fields are required.",
    "setup.errorPassword": "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols (!@#$%^&*).",
    "setup.recoveryTitle": "⚠️ Save Recovery Code",
    "setup.recoverySubtitle": "This is the only code to recover your owner account if you forget the password. Please save it securely.",
    "setup.copyCode": "Copy Code",
    "setup.copied": "Copied!",
    "setup.saveFile": "Save to File",
    "setup.importantNotice": "【Important Notice】",
    "setup.noticeText": "Currently, email sending (SMTP) is not configured. Until SMTP is set up, this recovery code is the ONLY way to recover your password. We strongly recommend setting up SMTP in the system settings before active use.",
    "setup.startApp": "Code Saved - Start Application",

    // サイドバー / Sidebar
    "sidebar.inbox": "Inbox",
    "sidebar.workspaceDoc": "Workspace Document",
    "sidebar.mediaLibrary": "Media Library",
    "sidebar.members": "Members",
    "sidebar.settings": "Settings",
    "sidebar.logout": "Logout",
    "sidebar.addWorkspace": "Add Workspace",
    "sidebar.channels": "Channels",
    "sidebar.browseChannels": "Browse Channels",
    "sidebar.addChannel": "Add Channel",
    "sidebar.dms": "Direct Messages",
    "sidebar.startDm": "Start DM",
    "sidebar.theme": "Toggle Theme",

    // プロフィール設定 / User Profile Modal
    "profile.title": "Profile Settings",
    "profile.email": "Email Address",
    "profile.emailHelp": "Email address cannot be changed.",
    "profile.displayName": "Display Name",
    "profile.avatar": "Avatar Image",
    "profile.uploadImage": "Upload Image",
    "profile.uploading": "Uploading...",
    "profile.save": "Save Changes",
    "profile.updateSuccess": "Profile updated successfully.",
    "profile.updateFailed": "Failed to update profile",
    "profile.pwChange": "Change Password",
    "profile.currentPw": "Current Password",
    "profile.newPw": "New Password",
    "profile.newPwHelp": "Must be 8+ characters and contain uppercase, lowercase, numbers, and symbols.",
    "profile.confirmPw": "Confirm New Password",
    "profile.pwChangeBtn": "Change Password",
    "profile.pwRequired": "Please fill in all password fields.",
    "profile.pwMismatch": "New password and confirmation password do not match.",
    "profile.pwFormatError": "New password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.",
    "profile.pwChangeSuccess": "Password changed successfully.",
    "profile.pwChangeFailed": "Failed to change password.",
    "profile.language": "Language Settings",

    // ワークスペース管理 / Workspace Management
    "workspace.mgmt": "Workspace Management",
    "workspace.members": "Members",
    "workspace.groups": "Groups",
    "workspace.statuses": "Statuses",
    "workspace.smtp": "SMTP Settings",
    "workspace.general": "General Settings",
    "workspace.rename": "Rename",
    "workspace.invite": "Invite Members",
    "workspace.add": "Add",
    "workspace.role.member": "Member",
    "workspace.role.guest": "Guest",
    "workspace.role.groupAdmin": "Group Admin",
    "workspace.role.owner": "Owner",
    "workspace.memberList": "Workspace Members",
    "workspace.dangerZone": "Danger Zone",
    "workspace.deleteText": "Deleting a workspace will delete all associated data. This action cannot be undone.",
    "workspace.deleteBtn": "Delete Workspace",
    "workspace.statusTitle": "Custom Status Settings",
    "workspace.statusHelp": "You can add, remove, and reorder status columns for task management (kanban board) to match your workflow.",
    "workspace.statusHelp2": "* Status names must be unique within the system.",
    "workspace.statusAddPlaceholder": "New status name (e.g., Under Review)",
    "workspace.statusOrderLabel": "Status order (top to bottom corresponds to left to right on the board)",
    "workspace.statusSaveBtn": "Save Status Settings",
    "workspace.tempPwIssued": "Temporary Password Issued",
    "workspace.tempPwHelp": "This is the new temporary password for the user. It cannot be displayed again once you close this window. Please copy it and share it with the user.",
    "workspace.copy": "Copy",
    "workspace.close": "Close"
  }
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['ja']) => string;
}

const LanguageContext = React.createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('cospace_language');
    if (saved === 'ja' || saved === 'en') return saved;
    // Fallback to browser language
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'ja' ? 'ja' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cospace_language', lang);
  };

  const t = (key: keyof typeof translations['ja']): string => {
    const dict = translations[language] || translations['ja'];
    return dict[key] || translations['ja'][key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
