import React, { useState } from 'react';
import {
  Calendar,
  CheckSquare,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Shield,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import { UILanguage } from '../types/secretary';
import { Translations } from '../i18n/translations';

export type ActiveTab = 'overview' | 'inbox' | 'tasks' | 'calendar' | 'chat' | 'memory' | 'android';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  language: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  t: Translations;
  counts: {
    unreadMessages: number;
    openTasks: number;
    pendingChanges: number;
  };
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  language,
  onLanguageChange,
  theme,
  onToggleTheme,
  t,
  counts,
  mobileOpen,
  onCloseMobile,
  onSignOut,
}) => {
  const [imgError, setImgError] = useState(false);

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }> = [
    { id: 'overview', label: t.nav.overview, icon: LayoutDashboard, badgeCount: counts.pendingChanges || undefined },
    { id: 'inbox', label: t.nav.inbox, icon: Inbox, badgeCount: counts.unreadMessages || undefined },
    { id: 'tasks', label: t.nav.tasks, icon: CheckSquare, badgeCount: counts.openTasks || undefined },
    { id: 'calendar', label: t.nav.calendar, icon: Calendar },
    { id: 'chat', label: t.nav.chat, icon: MessageSquare },
    { id: 'memory', label: t.nav.memory, icon: Shield },
    { id: 'android', label: t.nav.android, icon: Smartphone },
  ];

  const content = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64 select-none">
      <div>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onSelectTab('overview');
              onCloseMobile();
            }}
            className="text-left font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            {t.brandName}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums ml-2 ${
                      active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['en', 'zh', 'ms'] as UILanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === lang
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'zh' ? '中文' : 'BM'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? t.common.themeLight : t.common.themeDark}
            aria-label={theme === 'dark' ? t.common.themeLight : t.common.themeDark}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          {!imgError ? (
            <img
              src="/src/assets/images/avatar_secretary_owner_1795767303538.jpg"
              alt="Personal Workspace Owner"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
              KS
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">Personal Workspace</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">EN · 中文 · BM</p>
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title="Lock Workspace"
              aria-label="Lock Workspace"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
