import React, { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { MessageSource } from '../types/secretary';
import { Translations } from '../i18n/translations';

interface CaptureModalProps {
  open: boolean;
  onClose: () => void;
  onIngest: (payload: {
    source: MessageSource;
    sender: string;
    chatTitle: string;
    rawText: string;
  }) => Promise<void>;
  t: Translations;
}

const PRESET_MESSAGES: Array<{
  label: string;
  source: MessageSource;
  sender: string;
  chatTitle: string;
  text: string;
}> = [
  {
    label: 'Rojak (BM+EN+中文)',
    source: 'whatsapp',
    sender: 'Dr. Faridah',
    chatTitle: 'Research Seminar',
    text: 'Guys, seminar esok tukar masa dari 9am ke 11.30am at Bilik Kuliah 4 ya. 记得带 laptop untuk live demo.',
  },
  {
    label: '中文 WeChat',
    source: 'wechat',
    sender: '林学姐',
    chatTitle: '毕设交流群',
    text: '下周三下午2点在图书馆三楼讨论室开会核对系统测试报告，如果时间冲突请在今晚8点前告诉我。',
  },
  {
    label: 'Email Deadline',
    source: 'email',
    sender: 'Academic Affairs',
    chatTitle: 'Semester Submission Notice',
    text: 'Reminder: Final Thesis Draft submission closes on 2026-12-04 at 17:00 via the student portal. Late submissions require supervisor endorsement.',
  },
];

export const CaptureModal: React.FC<CaptureModalProps> = ({ open, onClose, onIngest, t }) => {
  const [source, setSource] = useState<MessageSource>('whatsapp');
  const [sender, setSender] = useState('');
  const [chatTitle, setChatTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onIngest({
        source,
        sender: sender.trim() || 'Direct Contact',
        chatTitle: chatTitle.trim(),
        rawText: rawText.trim(),
      });
      setRawText('');
      setSender('');
      setChatTitle('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.actions.captureMessage}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Quick fill:</span>
            {PRESET_MESSAGES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSource(preset.source);
                  setSender(preset.sender);
                  setChatTitle(preset.chatTitle);
                  setRawText(preset.text);
                }}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t.inbox.sourceLabel}
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as MessageSource)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="wechat">WeChat</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="manual">Manual Note</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t.inbox.senderLabel}
              </label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="e.g. Dr. Lim / 陈老师"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Group / Subject (optional)
            </label>
            <input
              type="text"
              value={chatTitle}
              onChange={(e) => setChatTitle(e.target.value)}
              placeholder="e.g. FYP Supervision Group"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t.inbox.originalText}
            </label>
            <textarea
              rows={4}
              required
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t.inbox.pastePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || !rawText.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {submitting ? t.inbox.analyzing : t.inbox.analyzeBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
