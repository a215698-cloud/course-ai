import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  IngestedMessage,
  PersonalMemory,
  PrivacySettings,
  ScheduleChangeAlert,
  SecretaryState,
  SecretaryTask,
} from '../src/types/secretary.ts';
import { addDaysIsoMYT, getKualaLumpurParts, KUALA_LUMPUR_TZ } from './timezone.ts';

const DATA_DIR = path.resolve(process.env.KAIRO_DATA_DIR || path.resolve(process.cwd(), 'data'));
const DB_PATH = path.resolve(DATA_DIR, 'kairo-secretary.db');
const LEGACY_JSON_PATH = path.resolve(DATA_DIR, 'secretary-store.json');

let dbInstance: DatabaseSync | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS workspace_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      passcode_hash TEXT NOT NULL,
      claimed_at TEXT NOT NULL
    );
  `);
  dbInstance = db;
  return db;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function redactSensitiveText(input: string): string {
  let out = input;
  // Malaysian MyKad / IC format (YYMMDD-PB-###G)
  out = out.replace(/\b\d{6}-\d{2}-\d{4}\b/g, '[REDACTED_IC]');
  // Chinese ID card (18 digits)
  out = out.replace(/\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g, '[REDACTED_ID]');
  // OTP / TAC / Verification codes (4-8 digits following keywords)
  out = out.replace(/((?:OTP|TAC|code|验证码|校验码|kod)\s*[:：#]?\s*)\d{4,8}/gi, '$1[REDACTED_OTP]');
  // Phone numbers (+60, +86, 01x, etc.)
  out = out.replace(/(?:\+?\d{1,3}[\s-]?)?(?:0?1\d[\s-]?\d{3,4}[\s-]?\d{4}|1[3-9]\d{9})/g, '[REDACTED_PHONE]');
  // Credit card / bank account sequences (12-19 digits with optional dashes/spaces)
  out = out.replace(/\b(?:\d[ -]*?){12,19}\b/g, '[REDACTED_ACCOUNT]');
  return out;
}

export function buildDefaultState(): SecretaryState {
  const today = addDaysIsoMYT(0);
  const tomorrow = addDaysIsoMYT(1);
  const plus2 = addDaysIsoMYT(2);
  const plus4 = addDaysIsoMYT(4);
  const nowIso = getKualaLumpurParts().isoOffset;

  const sampleMessages: IngestedMessage[] = [
    {
      id: 'msg_sample_1',
      source: 'whatsapp',
      sender: 'Dr. Lim Wei Jian',
      chatTitle: 'FYP Supervision Group',
      rawText:
        'Hi team, quick update: our FYP progress review tomorrow is moved from 10:00 AM to 2:30 PM at Bilik Seminar 2 (FTSM). Please bring your printed system architecture diagram.',
      redactedText:
        'Hi team, quick update: our FYP progress review tomorrow is moved from 10:00 AM to 2:30 PM at Bilik Seminar 2 (FTSM). Please bring your printed system architecture diagram.',
      receivedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      detectedLanguages: ['English', 'Malay'],
      summary: 'FYP progress review tomorrow rescheduled from 10:00 AM to 2:30 PM at Bilik Seminar 2 (FTSM); bring printed architecture diagram.',
      importance: 'critical',
      importanceReason: 'Schedule change with revised venue and mandatory deliverable.',
      entities: {
        dates: [tomorrow],
        times: ['14:30'],
        locations: ['Bilik Seminar 2 (FTSM)'],
        people: ['Dr. Lim Wei Jian'],
        actionItems: ['Print system architecture diagram before 2:30 PM'],
      },
      linkedTaskIds: ['task_sample_1', 'task_sample_2'],
      isSample: true,
      read: false,
    },
    {
      id: 'msg_sample_2',
      source: 'wechat',
      sender: '陈老师 (Prof. Chen)',
      chatTitle: 'AI 课程研究群',
      rawText:
        '各位同学注意：下周四的 Literature Review 报告截止时间提前到本周五晚上 11:59 前提交到 UKM Folio，记得附上英文摘要。',
      redactedText:
        '各位同学注意：下周四的 Literature Review 报告截止时间提前到本周五晚上 11:59 前提交到 UKM Folio，记得附上英文摘要。',
      receivedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      detectedLanguages: ['Chinese', 'English'],
      summary: 'Literature Review report deadline moved earlier to Friday 23:59 on UKM Folio with an English abstract.',
      importance: 'high',
      importanceReason: 'Assignment deadline moved earlier.',
      entities: {
        dates: [plus2],
        times: ['23:59'],
        locations: ['UKM Folio'],
        people: ['陈老师 (Prof. Chen)'],
        actionItems: ['Submit Literature Review with English abstract on UKM Folio'],
      },
      linkedTaskIds: ['task_sample_3'],
      isSample: true,
      read: false,
    },
    {
      id: 'msg_sample_3',
      source: 'whatsapp',
      sender: 'Aina (Project Partner)',
      chatTitle: 'Capstone Group',
      rawText:
        'Wei, jangan lupa kita ada discussion pukul 4.00 petang hari ini kat Library Level 3 tau. Aku dah book bilik perbincangan B, nanti bincang slide pembentangan sekali.',
      redactedText:
        'Wei, jangan lupa kita ada discussion pukul 4.00 petang hari ini kat Library Level 3 tau. Aku dah book bilik perbincangan B, nanti bincang slide pembentangan sekali.',
      receivedAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
      detectedLanguages: ['Malay', 'English'],
      summary: 'Project discussion today at 4:00 PM in Library Level 3 (Discussion Room B) to review presentation slides.',
      importance: 'high',
      importanceReason: 'Same-day meeting with booked venue.',
      entities: {
        dates: [today],
        times: ['16:00'],
        locations: ['Library Level 3, Discussion Room B'],
        people: ['Aina'],
        actionItems: ['Prepare presentation slides for 4:00 PM discussion'],
      },
      linkedTaskIds: ['task_sample_4'],
      isSample: true,
      read: true,
    },
  ];

  const sampleTasks: SecretaryTask[] = [
    {
      id: 'task_sample_1',
      title: 'FYP Progress Review with Dr. Lim',
      description: 'Originally 10:00 AM; message update indicates move to 14:30 at Bilik Seminar 2 (FTSM).',
      category: 'meeting',
      status: 'pending',
      priority: 'critical',
      dueDate: tomorrow,
      dueTime: '10:00',
      location: 'Main Meeting Room',
      sourceMessageId: 'msg_sample_1',
      sourceApp: 'whatsapp',
      sourceSender: 'Dr. Lim Wei Jian',
      reminderMinutesBefore: 45,
      reminderDismissed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'task_sample_2',
      title: 'Print system architecture diagram',
      description: 'Required for FYP progress review with Dr. Lim.',
      category: 'task',
      status: 'pending',
      priority: 'high',
      dueDate: tomorrow,
      dueTime: '14:00',
      location: 'FTSM Print Lab',
      sourceMessageId: 'msg_sample_1',
      sourceApp: 'whatsapp',
      sourceSender: 'Dr. Lim Wei Jian',
      reminderMinutesBefore: 60,
      reminderDismissed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'task_sample_3',
      title: 'Submit Literature Review Report (with English Abstract)',
      description: 'Upload PDF to UKM Folio before 23:59.',
      category: 'assignment',
      status: 'in_progress',
      priority: 'high',
      dueDate: plus2,
      dueTime: '23:59',
      location: 'UKM Folio',
      sourceMessageId: 'msg_sample_2',
      sourceApp: 'wechat',
      sourceSender: '陈老师 (Prof. Chen)',
      reminderMinutesBefore: 180,
      reminderDismissed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'task_sample_4',
      title: 'Capstone Presentation Slide Discussion',
      description: 'Meet Aina to finalize presentation slides.',
      category: 'meeting',
      status: 'pending',
      priority: 'high',
      dueDate: today,
      dueTime: '16:00',
      location: 'Library Level 3, Discussion Room B',
      sourceMessageId: 'msg_sample_3',
      sourceApp: 'whatsapp',
      sourceSender: 'Aina (Project Partner)',
      reminderMinutesBefore: 30,
      reminderDismissed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'task_sample_5',
      title: 'Weekly Lab Equipment Reservation',
      description: 'Confirm Android test device checkout for next week.',
      category: 'reminder',
      status: 'pending',
      priority: 'normal',
      dueDate: plus4,
      dueTime: '11:00',
      location: 'Mobile Systems Lab',
      sourceMessageId: null,
      sourceApp: 'manual',
      sourceSender: 'Personal Note',
      reminderMinutesBefore: 30,
      reminderDismissed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const sampleChanges: ScheduleChangeAlert[] = [
    {
      id: 'chg_sample_1',
      title: 'FYP Progress Review Rescheduled & Venue Changed',
      changeType: 'rescheduled',
      summary: 'Dr. Lim moved tomorrow’s FYP Progress Review from 10:00 AM to 2:30 PM at Bilik Seminar 2 (FTSM).',
      previousValue: `${tomorrow} 10:00 · Main Meeting Room`,
      newValue: `${tomorrow} 14:30 · Bilik Seminar 2 (FTSM)`,
      targetTaskId: 'task_sample_1',
      proposedDueDate: tomorrow,
      proposedDueTime: '14:30',
      proposedLocation: 'Bilik Seminar 2 (FTSM)',
      sourceMessageIds: ['msg_sample_1'],
      status: 'pending',
      detectedAt: nowIso,
    },
  ];

  const sampleMemories: PersonalMemory[] = [
    {
      id: 'mem_1',
      category: 'contact',
      key: 'Dr. Lim Wei Jian',
      content: 'FYP academic supervisor at FTSM. Messages from him regarding reviews or deliverables should always be flagged high priority.',
      source: 'user',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'mem_2',
      category: 'preference',
      key: 'Morning Focus Block',
      content: 'Prefer avoiding non-urgent meetings before 9:30 AM; reserve mornings for deep research writing.',
      source: 'user',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'mem_3',
      category: 'course_project',
      key: 'UKM Folio Submissions',
      content: 'All course assignments from Prof. Chen must be submitted in PDF format with an English abstract.',
      source: 'user',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const defaultPrivacy: PrivacySettings = {
    enabledSources: {
      whatsapp: true,
      wechat: true,
      email: true,
      sms: false,
      manual: true,
    },
    redactSensitiveInfo: true,
    blockedSenders: ['Promo Bot', 'Bank Alert OTP'],
    storeRawMessages: true,
    proactiveRemindersEnabled: true,
  };

  return {
    messages: sampleMessages,
    tasks: sampleTasks,
    scheduleChanges: sampleChanges,
    memories: sampleMemories,
    briefings: [],
    chatHistory: [],
    privacy: defaultPrivacy,
    lastCrossAnalysisAt: null,
  };
}

export async function readStore(): Promise<SecretaryState> {
  const db = getDb();
  const row = db.prepare('SELECT state_json FROM workspace_state WHERE id = 1').get() as { state_json?: string } | undefined;
  if (row?.state_json) {
    return JSON.parse(row.state_json) as SecretaryState;
  }

  // Attempt one-time migration from legacy JSON file if present
  try {
    const legacyRaw = await fsp.readFile(LEGACY_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(legacyRaw) as SecretaryState;
    await writeStore(parsed);
    return parsed;
  } catch {
    const initial = buildDefaultState();
    await writeStore(initial);
    return initial;
  }
}

export async function writeStore(nextState: SecretaryState): Promise<SecretaryState> {
  writeQueue = writeQueue.then(async () => {
    const db = getDb();
    const nowIso = getKualaLumpurParts().isoOffset;
    db.prepare(
      `INSERT INTO workspace_state (id, state_json, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(nextState), nowIso);
  });
  await writeQueue;
  return nextState;
}

export async function mutateStore(
  updater: (current: SecretaryState) => SecretaryState | Promise<SecretaryState>
): Promise<SecretaryState> {
  const current = await readStore();
  const updated = await updater(current);
  return writeStore(updated);
}

export function getClaimedPasscodeHash(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT passcode_hash FROM auth_config WHERE id = 1').get() as { passcode_hash?: string } | undefined;
  return row?.passcode_hash || null;
}

export function claimPasscodeHashIfEmpty(passcodeHash: string): boolean {
  const db = getDb();
  const nowIso = getKualaLumpurParts().isoOffset;
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO auth_config (id, passcode_hash, claimed_at)
       VALUES (1, ?, ?)`
    )
    .run(passcodeHash, nowIso);
  return Number(result.changes) > 0;
}

export function getStorageInfo(): { engine: string; dbPath: string } {
  return {
    engine: 'sqlite',
    dbPath: DB_PATH,
  };
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDateTime(dateStr: string, timeStr: string | null): { dtStart: string; dtEnd: string; isAllDay: boolean } {
  const compactDate = dateStr.replace(/-/g, '');
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return { dtStart: compactDate, dtEnd: compactDate, isAllDay: true };
  }
  const [hh, mm] = timeStr.split(':').map(Number);
  const start = new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const p = getKualaLumpurParts(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${p.year}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}00`;
  };
  return { dtStart: fmt(start), dtEnd: fmt(end), isAllDay: false };
}

export function buildIcsFeed(tasks: SecretaryTask[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kairo AI Secretary//Multilingual Personal Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kairo Secretary Schedule',
    `X-WR-TIMEZONE:${KUALA_LUMPUR_TZ}`,
    'BEGIN:VTIMEZONE',
    `TZID:${KUALA_LUMPUR_TZ}`,
    'BEGIN:STANDARD',
    'DTSTART:19820101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:MYT',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const task of tasks) {
    if (!task.dueDate || task.status === 'completed') continue;
    const { dtStart, dtEnd, isAllDay } = formatIcsDateTime(task.dueDate, task.dueTime);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@kairo.secretary.local`);
    lines.push(`DTSTAMP:${dtStamp}`);
    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    } else {
      lines.push(`DTSTART;TZID=${KUALA_LUMPUR_TZ}:${dtStart}`);
      lines.push(`DTEND;TZID=${KUALA_LUMPUR_TZ}:${dtEnd}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(`[${task.category.toUpperCase()}] ${task.title}`)}`);
    const descParts = [task.description];
    if (task.sourceSender) descParts.push(`Source: ${task.sourceApp} (${task.sourceSender})`);
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.filter(Boolean).join(' | '))}`);
    if (task.location) {
      lines.push(`LOCATION:${escapeIcsText(task.location)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
