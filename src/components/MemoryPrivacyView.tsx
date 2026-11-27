import React, { useState } from 'react';
import { Download, Plus, Shield, Trash2, X } from 'lucide-react';
import { MessageSource, PersonalMemory, PrivacySettings, SecretaryState } from '../types/secretary';
import { Translations } from '../i18n/translations';
import { formatSourceName } from '../utils/dateUtils';

interface MemoryPrivacyViewProps {
  state: SecretaryState;
  t: Translations;
  onAddMemory: (payload: {
    key: string;
    content: string;
    category: PersonalMemory['category'];
  }) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onUpdatePrivacy: (patch: Partial<PrivacySettings>) => Promise<void>;
  onResetWorkspace: (mode: 'empty' | 'defaults') => Promise<void>;
  onDownloadBackup: () => Promise<void>;
}

export const MemoryPrivacyView: React.FC<MemoryPrivacyViewProps> = ({
  state,
  t,
  onAddMemory,
  onDeleteMemory,
  onUpdatePrivacy,
  onResetWorkspace,
  onDownloadBackup,
}) => {
  const [memKey, setMemKey] = useState('');
  const [memContent, setMemContent] = useState('');
  const [memCategory, setMemCategory] = useState<PersonalMemory['category']>('preference');
  const [blockedInput, setBlockedInput] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memKey.trim() || !memContent.trim()) return;
    await onAddMemory({
      key: memKey.trim(),
      content: memContent.trim(),
      category: memCategory,
    });
    setMemKey('');
    setMemContent('');
  };

  const handleToggleSource = async (source: MessageSource) => {
    await onUpdatePrivacy({
      enabledSources: {
        ...state.privacy.enabledSources,
        [source]: !state.privacy.enabledSources[source],
      },
    });
  };

  const handleAddBlocked = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = blockedInput.trim();
    if (!name) return;
    if (!state.privacy.blockedSenders.includes(name)) {
      await onUpdatePrivacy({
        blockedSenders: [...state.privacy.blockedSenders, name],
      });
    }
    setBlockedInput('');
  };

  const handleRemoveBlocked = async (name: string) => {
    await onUpdatePrivacy({
      blockedSenders: state.privacy.blockedSenders.filter((s) => s !== name),
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Personal Memory Vault */}
      <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.memory.memoryVault}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Injected into Gemini summarization, schedule conflict detection, and briefings.
          </p>
        </div>

        <form onSubmit={handleAddMemory} className="space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={memKey}
              onChange={(e) => setMemKey(e.target.value)}
              placeholder="Title / Contact / Course"
              className="sm:col-span-2 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <select
              value={memCategory}
              onChange={(e) => setMemCategory(e.target.value as PersonalMemory['category'])}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="preference">Preference</option>
              <option value="contact">Contact / Role</option>
              <option value="course_project">Course / Project</option>
              <option value="routine">Routine</option>
              <option value="fact">Fact</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={memContent}
              onChange={(e) => setMemContent(e.target.value)}
              placeholder="e.g. Never schedule non-urgent calls before 9:30 AM"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.actions.addMemory}
            </button>
          </div>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {state.memories.length === 0 ? (
            <p className="py-6 text-sm text-slate-500 dark:text-slate-400">No personal memories stored yet.</p>
          ) : (
            state.memories.map((mem) => (
              <div key={mem.id} className="py-3.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{mem.key}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mem.category.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mem.source === 'ai_suggested' ? 'AI Suggested' : 'User'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{mem.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMemory(mem.id)}
                  aria-label={`Delete ${mem.key}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Privacy & Data Ownership Controls */}
      <section className="xl:col-span-5 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Shield className="w-4 h-4 text-slate-500" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.memory.privacyControls}
            </h2>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
              {t.memory.enabledSources}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {(['whatsapp', 'wechat', 'email', 'sms', 'manual'] as MessageSource[]).map((src) => {
                const enabled = state.privacy.enabledSources[src];
                return (
                  <label
                    key={src}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span>{formatSourceName(src)}</span>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleSource(src)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.memory.redactLabel}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.memory.redactDesc}</p>
              </div>
              <input
                type="checkbox"
                checked={state.privacy.redactSensitiveInfo}
                onChange={(e) => onUpdatePrivacy({ redactSensitiveInfo: e.target.checked })}
                className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </label>

            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.memory.storeRawLabel}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.memory.storeRawDesc}</p>
              </div>
              <input
                type="checkbox"
                checked={state.privacy.storeRawMessages}
                onChange={(e) => onUpdatePrivacy({ storeRawMessages: e.target.checked })}
                className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.memory.blockedSenders}</p>
            <form onSubmit={handleAddBlocked} className="flex gap-2">
              <input
                type="text"
                value={blockedInput}
                onChange={(e) => setBlockedInput(e.target.value)}
                placeholder={t.memory.blockedPlaceholder}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {t.memory.addBlocked}
              </button>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.privacy.blockedSenders.map((sender) => (
                <div key={sender} className="py-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                  <span>{sender}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlocked(sender)}
                    aria-label={`Unblock ${sender}`}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Ownership */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.memory.dataOwnership}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onDownloadBackup()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {t.actions.exportBackup}
            </button>

            {!confirmWipe ? (
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap"
              >
                {t.actions.resetWorkspace}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onResetWorkspace('empty');
                    setConfirmWipe(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmWipe(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {t.actions.cancel}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
