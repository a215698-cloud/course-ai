import { ImportanceLevel, MessageSource, SecretaryTask, UILanguage } from '../types/secretary';

export function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getRelativeDeadlineLabel(
  dueDate: string | null,
  dueTime: string | null,
  lang: UILanguage
): { label: string; isOverdue: boolean; isUrgent: boolean } {
  if (!dueDate) {
    const noDate = lang === 'zh' ? '无截止日期' : lang === 'ms' ? 'Tiada tarikh' : 'No due date';
    return { label: noDate, isOverdue: false, isUrgent: false };
  }

  const timePart = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '23:59';
  const target = new Date(`${dueDate}T${timePart}:00`);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${getTodayIso()}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const absH = Math.abs(diffHours);
    const label =
      absH < 24
        ? lang === 'zh'
          ? `已逾期 ${absH} 小时`
          : lang === 'ms'
            ? `Lewat ${absH} jam`
            : `Overdue by ${absH}h`
        : lang === 'zh'
          ? `已逾期 ${Math.abs(diffDays)} 天`
          : lang === 'ms'
            ? `Lewat ${Math.abs(diffDays)} hari`
            : `Overdue by ${Math.abs(diffDays)}d`;
    return { label, isOverdue: true, isUrgent: true };
  }

  if (diffDays === 0) {
    const label =
      diffHours <= 1
        ? lang === 'zh'
          ? '1 小时内截止'
          : lang === 'ms'
            ? 'Kurang 1 jam lagi'
            : 'Due within 1h'
        : lang === 'zh'
          ? `今天 ${dueTime || ''} (${diffHours}h)`
          : lang === 'ms'
            ? `Hari ini ${dueTime || ''} (${diffHours}j)`
            : `Today ${dueTime || ''} (${diffHours}h)`;
    return { label: label.trim(), isOverdue: false, isUrgent: true };
  }

  if (diffDays === 1) {
    const label =
      lang === 'zh'
        ? `明天 ${dueTime || ''}`
        : lang === 'ms'
          ? `Esok ${dueTime || ''}`
          : `Tomorrow ${dueTime || ''}`;
    return { label: label.trim(), isOverdue: false, isUrgent: true };
  }

  const label =
    lang === 'zh'
      ? `${diffDays} 天后 · ${dueDate}`
      : lang === 'ms'
        ? `${diffDays} hari lagi · ${dueDate}`
        : `In ${diffDays}d · ${dueDate}`;
  return { label, isOverdue: false, isUrgent: diffDays <= 2 };
}

export function buildGoogleCalendarUrl(task: SecretaryTask): string {
  const title = encodeURIComponent(task.title);
  const details = encodeURIComponent(
    [task.description, task.sourceSender ? `Source: ${task.sourceApp} (${task.sourceSender})` : '']
      .filter(Boolean)
      .join('\n')
  );
  const location = encodeURIComponent(task.location || '');

  let datesParam = '';
  if (task.dueDate) {
    const cleanDate = task.dueDate.replace(/-/g, '');
    if (task.dueTime && /^\d{2}:\d{2}$/.test(task.dueTime)) {
      const [hh, mm] = task.dueTime.split(':').map(Number);
      const start = new Date(`${task.dueDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const fmt = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
      datesParam = `&dates=${fmt(start)}/${fmt(end)}`;
    } else {
      datesParam = `&dates=${cleanDate}/${cleanDate}`;
    }
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${datesParam}&details=${details}&location=${location}`;
}

export function formatSourceName(source: MessageSource | 'assistant'): string {
  switch (source) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'wechat':
      return 'WeChat';
    case 'email':
      return 'Email';
    case 'sms':
      return 'SMS';
    case 'assistant':
      return 'Kairo AI';
    default:
      return 'Manual';
  }
}

export function importanceTextColor(level: ImportanceLevel): string {
  switch (level) {
    case 'critical':
      return 'text-red-600 dark:text-red-400 font-semibold';
    case 'high':
      return 'text-amber-600 dark:text-amber-400 font-medium';
    case 'normal':
      return 'text-slate-600 dark:text-slate-400';
    case 'low':
      return 'text-slate-400 dark:text-slate-500';
  }
}

/**
 * Parses common WhatsApp exported .txt lines like:
 * [27/11/2026, 14:30:10] Sender Name: Message content
 * or 27/11/2026, 14:30 - Sender Name: Message content
 */
export function parseWhatsAppTxtExport(rawContent: string): Array<{ sender: string; text: string }> {
  const lines = rawContent.split(/\r?\n/);
  const entries: Array<{ sender: string; text: string }> = [];
  const regex = /^(?:\[?\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?\]?\s*[-–]?\s*)([^:]+):\s*(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(regex);
    if (match) {
      const sender = match[1].trim();
      const text = match[2].trim();
      if (text && !text.includes('Messages and calls are end-to-end encrypted')) {
        entries.push({ sender, text });
      }
    } else if (entries.length > 0) {
      entries[entries.length - 1].text += ` ${trimmed}`;
    }
  }

  if (entries.length === 0 && rawContent.trim()) {
    return [{ sender: 'Imported Chat Log', text: rawContent.trim().slice(0, 4000) }];
  }
  return entries.slice(-5); // Analyze latest 5 messages cleanly
}
