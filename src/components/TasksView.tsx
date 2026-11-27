import React, { useState } from 'react';
import {
  CalendarPlus,
  Check,
  ExternalLink,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import { ImportanceLevel, SecretaryState, TaskCategory, UILanguage } from '../types/secretary';
import { Translations } from '../i18n/translations';
import {
  buildGoogleCalendarUrl,
  formatSourceName,
  getRelativeDeadlineLabel,
  importanceTextColor,
} from '../utils/dateUtils';

interface TasksViewProps {
  state: SecretaryState;
  language: UILanguage;
  t: Translations;
  onCreateTask: (payload: {
    title: string;
    description: string;
    category: TaskCategory;
    priority: ImportanceLevel;
    dueDate: string;
    dueTime: string;
    location: string;
  }) => Promise<void>;
  onToggleStatus: (id: string, status: 'pending' | 'completed') => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onInspectSourceMessage: (messageId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  state,
  language,
  t,
  onCreateTask,
  onToggleStatus,
  onDeleteTask,
  onInspectSourceMessage,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed'>('pending');
  const [showAddForm, setShowAddForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('assignment');
  const [priority, setPriority] = useState<ImportanceLevel>('high');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredTasks = state.tasks
    .filter((task) => {
      if (statusFilter === 'pending' && task.status === 'completed') return false;
      if (statusFilter === 'completed' && task.status !== 'completed') return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return `${a.dueDate} ${a.dueTime || '23:59'}`.localeCompare(`${b.dueDate} ${b.dueTime || '23:59'}`);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreateTask({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        dueDate,
        dueTime,
        location: location.trim(),
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setLocation('');
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'assignment', 'meeting', 'task', 'reminder'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.tasks[cat]}
              </button>
            ))}
          </div>

          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['pending', 'completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.tasks[st]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.actions.addTask}
        </button>
      </div>

      {/* Inline Add Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submit FYP Chapter 3 Draft"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="assignment">{t.tasks.assignment}</option>
                <option value="meeting">{t.tasks.meeting}</option>
                <option value="task">{t.tasks.task}</option>
                <option value="reminder">{t.tasks.reminder}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ImportanceLevel)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="critical">{t.common.critical}</option>
                <option value="high">{t.common.high}</option>
                <option value="normal">{t.common.normal}</option>
                <option value="low">{t.common.low}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.common.location}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bilik Seminar 2 / Zoom"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details or submission instructions..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t.actions.save}
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.tasks.emptyTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.tasks.emptyDesc}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
          {filteredTasks.map((task) => {
            const rel = getRelativeDeadlineLabel(task.dueDate, task.dueTime, language);
            const isDone = task.status === 'completed';
            return (
              <div
                key={task.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleStatus(task.id, isDone ? 'pending' : 'completed')}
                    aria-label={isDone ? 'Reopen task' : 'Complete task'}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-600'
                    }`}
                  >
                    {isDone && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className={importanceTextColor(task.priority)}>{t.common[task.priority]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.tasks[task.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatSourceName(task.sourceApp)}
                        {task.sourceSender ? ` (${task.sourceSender})` : ''}
                      </span>
                      {task.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {task.location}
                          </span>
                        </>
                      )}
                      {task.sourceMessageId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => onInspectSourceMessage(task.sourceMessageId!)}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {t.tasks.sourceTrace}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 pl-8 lg:pl-0">
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isDone
                        ? 'text-slate-400'
                        : rel.isOverdue
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : rel.isUrgent
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {rel.label}
                  </span>

                  {task.dueDate && (
                    <a
                      href={buildGoogleCalendarUrl(task)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t.actions.addToGoogleCal}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      {t.actions.addToGoogleCal}
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    aria-label="Delete task"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
