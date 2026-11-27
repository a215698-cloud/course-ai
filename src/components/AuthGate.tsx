import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { UILanguage } from '../types/secretary';

interface AuthGateProps {
  claimed: boolean;
  language: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
  onAuthenticated: (token: string) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  claimed,
  language,
  onLanguageChange,
  onAuthenticated,
}) => {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy =
    language === 'zh'
      ? {
          titleClaim: '设置 Kairo 私人工作区访问口令',
          subtitleClaim: '首次使用请设置至少 6 位访问口令。手机 Android App 与网页端将使用同一口令加密验证，保护你的私人消息与记忆。',
          titleLogin: '解锁 Kairo 私人秘书',
          subtitleLogin: '请输入工作区访问口令以读取你的消息、日程与个人记忆。',
          passcodeLabel: '访问口令（至少 6 位）',
          confirmLabel: '确认访问口令',
          btnClaim: '设置口令并进入',
          btnLogin: '验证并解锁',
          mismatch: '两次输入的口令不一致。',
          tooShort: '口令至少需要 6 个字符。',
        }
      : language === 'ms'
        ? {
            titleClaim: 'Tetapkan Kod Laluan Ruang Kerja Kairo',
            subtitleClaim: 'Tetapkan kod laluan sekurang-kurangnya 6 aksara untuk kegunaan kali pertama. Kedua-dua web dan aplikasi Android menggunakan kod ini untuk melindungi mesej peribadi anda.',
            titleLogin: 'Buka Kunci Setiausaha Kairo',
            subtitleLogin: 'Masukkan kod laluan ruang kerja anda untuk mengakses mesej, jadual dan memori peribadi.',
            passcodeLabel: 'Kod Laluan (min 6 aksara)',
            confirmLabel: 'Sahkan Kod Laluan',
            btnClaim: 'Simpan & Masuk',
            btnLogin: 'Log Masuk',
            mismatch: 'Kod laluan pengesahan tidak sepadan.',
            tooShort: 'Kod laluan mestilah sekurang-kurangnya 6 aksara.',
          }
        : {
            titleClaim: 'Set Your Kairo Workspace Passcode',
            subtitleClaim: 'Create a private passcode (min 6 characters) for first-time setup. Both this web workspace and your Android app use this passcode to protect your messages and memory.',
            titleLogin: 'Unlock Kairo Secretary',
            subtitleLogin: 'Enter your workspace passcode to access your private messages, deadlines, and memory.',
            passcodeLabel: 'Workspace Passcode (min 6 chars)',
            confirmLabel: 'Confirm Passcode',
            btnClaim: 'Set Passcode & Continue',
            btnLogin: 'Unlock Workspace',
            mismatch: 'Passcodes do not match.',
            tooShort: 'Passcode must be at least 6 characters.',
          };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passcode.trim();
    if (trimmed.length < 6) {
      setError(copy.tooShort);
      return;
    }
    if (!claimed && trimmed !== confirmPasscode.trim()) {
      setError(copy.mismatch);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const endpoint = claimed ? '/api/auth/login' : '/api/auth/claim';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Authentication failed.');
      }
      onAuthenticated(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {claimed ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['en', 'zh', 'ms'] as UILanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  language === lang
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'zh' ? '中文' : 'BM'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {claimed ? copy.titleLogin : copy.titleClaim}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {claimed ? copy.subtitleLogin : copy.subtitleClaim}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {copy.passcodeLabel}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {!claimed && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {copy.confirmLabel}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {claimed ? copy.btnLogin : copy.btnClaim}
          </button>
        </form>
      </div>
    </div>
  );
};
