export type UILanguage = 'en' | 'zh' | 'ms';

export type MessageSource = 'whatsapp' | 'wechat' | 'email' | 'sms' | 'manual';

export type ImportanceLevel = 'critical' | 'high' | 'normal' | 'low';

export type TaskCategory = 'assignment' | 'meeting' | 'task' | 'reminder';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface ExtractedEntities {
  dates: string[];
  times: string[];
  locations: string[];
  people: string[];
  actionItems: string[];
}

export interface IngestedMessage {
  id: string;
  source: MessageSource;
  sender: string;
  chatTitle?: string;
  rawText: string;
  redactedText: string;
  receivedAt: string;
  detectedLanguages: string[];
  summary: string;
  importance: ImportanceLevel;
  importanceReason: string;
  entities: ExtractedEntities;
  linkedTaskIds: string[];
  isSample?: boolean;
  read: boolean;
}

export interface SecretaryTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: ImportanceLevel;
  dueDate: string | null; // ISO date YYYY-MM-DD
  dueTime: string | null; // HH:mm 24h
  location: string | null;
  sourceMessageId: string | null;
  sourceApp: MessageSource | 'assistant';
  sourceSender: string | null;
  reminderMinutesBefore: number;
  reminderDismissed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleChangeAlert {
  id: string;
  title: string;
  changeType: 'rescheduled' | 'location_changed' | 'cancelled' | 'conflict' | 'new_requirement';
  summary: string;
  previousValue: string;
  newValue: string;
  targetTaskId: string | null;
  proposedDueDate: string | null;
  proposedDueTime: string | null;
  proposedLocation: string | null;
  sourceMessageIds: string[];
  status: 'pending' | 'applied' | 'dismissed';
  detectedAt: string;
}

export interface PersonalMemory {
  id: string;
  category: 'preference' | 'contact' | 'course_project' | 'routine' | 'fact';
  key: string;
  content: string;
  source: 'user' | 'ai_suggested';
  createdAt: string;
  updatedAt: string;
}

export interface DailyBriefing {
  id: string;
  date: string;
  language: UILanguage;
  headline: string;
  overview: string;
  topPriorities: string[];
  scheduleSummary: string[];
  watchouts: string[];
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  suggestedActions?: Array<{
    type: 'create_task' | 'save_memory';
    label: string;
    payload: Record<string, string>;
    applied?: boolean;
  }>;
}

export interface PrivacySettings {
  enabledSources: Record<MessageSource, boolean>;
  redactSensitiveInfo: boolean;
  blockedSenders: string[];
  storeRawMessages: boolean;
  proactiveRemindersEnabled: boolean;
}

export interface SecretaryState {
  messages: IngestedMessage[];
  tasks: SecretaryTask[];
  scheduleChanges: ScheduleChangeAlert[];
  memories: PersonalMemory[];
  briefings: DailyBriefing[];
  chatHistory: ChatMessage[];
  privacy: PrivacySettings;
  lastCrossAnalysisAt: string | null;
}
