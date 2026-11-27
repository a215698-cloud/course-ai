import { UILanguage } from '../types/secretary';

export interface Translations {
  brandName: string;
  nav: {
    overview: string;
    inbox: string;
    tasks: string;
    calendar: string;
    chat: string;
    memory: string;
    android: string;
  };
  actions: {
    captureMessage: string;
    generateBriefing: string;
    runCrossAnalysis: string;
    addTask: string;
    addMemory: string;
    exportIcs: string;
    addToGoogleCal: string;
    applyChange: string;
    dismiss: string;
    save: string;
    cancel: string;
    delete: string;
    send: string;
    loadSamplePack: string;
    importChatLog: string;
    exportBackup: string;
    resetWorkspace: string;
    enableBrowserAlerts: string;
  };
  overview: {
    title: string;
    subtitle: string;
    briefingTitle: string;
    briefingEmpty: string;
    generatingBriefing: string;
    urgentDeadlines: string;
    scheduleChanges: string;
    proactiveReminders: string;
    statsActiveTasks: string;
    statsImportantMsgs: string;
    statsScheduleAlerts: string;
    statsMemories: string;
    topPriorities: string;
    todaySchedule: string;
    watchouts: string;
  };
  inbox: {
    title: string;
    subtitle: string;
    filterAll: string;
    filterImportant: string;
    filterUnread: string;
    pastePlaceholder: string;
    sourceLabel: string;
    senderLabel: string;
    analyzeBtn: string;
    analyzing: string;
    emptyTitle: string;
    emptyDesc: string;
    extractedEntities: string;
    linkedTasks: string;
    originalText: string;
    redactedNote: string;
    pausedNotice: string;
    blockedNotice: string;
  };
  tasks: {
    title: string;
    subtitle: string;
    all: string;
    assignment: string;
    meeting: string;
    task: string;
    reminder: string;
    pending: string;
    completed: string;
    overdue: string;
    dueToday: string;
    sourceTrace: string;
    emptyTitle: string;
    emptyDesc: string;
  };
  calendar: {
    title: string;
    subtitle: string;
    today: string;
    noEventsDay: string;
    exportHint: string;
  };
  chat: {
    title: string;
    subtitle: string;
    placeholder: string;
    quickPrompts: string[];
    clearChat: string;
  };
  memory: {
    title: string;
    subtitle: string;
    memoryVault: string;
    privacyControls: string;
    enabledSources: string;
    redactLabel: string;
    redactDesc: string;
    storeRawLabel: string;
    storeRawDesc: string;
    blockedSenders: string;
    blockedPlaceholder: string;
    addBlocked: string;
    dataOwnership: string;
  };
  android: {
    title: string;
    subtitle: string;
    limitationTitle: string;
    limitationBody: string;
    blueprintTitle: string;
    testEndpointTitle: string;
  };
  common: {
    critical: string;
    high: string;
    normal: string;
    low: string;
    noDate: string;
    location: string;
    sender: string;
    source: string;
    language: string;
    loading: string;
    themeLight: string;
    themeDark: string;
  };
}

export const TRANSLATIONS: Record<UILanguage, Translations> = {
  en: {
    brandName: 'Kairo Secretary',
    nav: {
      overview: 'Overview',
      inbox: 'Inbox & Triage',
      tasks: 'Tasks & Deadlines',
      calendar: 'Calendar',
      chat: 'AI Assistant',
      memory: 'Memory & Privacy',
      android: 'Android Bridge',
    },
    actions: {
      captureMessage: 'Capture Message',
      generateBriefing: 'Generate Briefing',
      runCrossAnalysis: 'Cross-Analyze Schedule',
      addTask: 'New Task',
      addMemory: 'Add Memory',
      exportIcs: 'Export .ics',
      addToGoogleCal: 'Google Calendar',
      applyChange: 'Apply Update',
      dismiss: 'Dismiss',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      send: 'Send',
      loadSamplePack: 'Load Sample Messages',
      importChatLog: 'Import .txt Log',
      exportBackup: 'Export JSON',
      resetWorkspace: 'Clear All Data',
      enableBrowserAlerts: 'Enable Alerts',
    },
    overview: {
      title: 'Executive Briefing',
      subtitle: 'Trilingual synthesis across your messages, assignments, meetings, and personal memory.',
      briefingTitle: 'Daily AI Briefing',
      briefingEmpty: 'No briefing generated for today yet. Generate one from your live inbox, deadlines, and memory.',
      generatingBriefing: 'Synthesizing briefing...',
      urgentDeadlines: 'Upcoming & Urgent Deadlines',
      scheduleChanges: 'Detected Schedule Changes',
      proactiveReminders: 'Proactive Reminders',
      statsActiveTasks: 'Open Tasks',
      statsImportantMsgs: 'Important Messages',
      statsScheduleAlerts: 'Schedule Alerts',
      statsMemories: 'Memory Entries',
      topPriorities: 'Top Priorities',
      todaySchedule: 'Schedule & Timing',
      watchouts: 'Conflicts & Watchouts',
    },
    inbox: {
      title: 'Message Inbox & Triage',
      subtitle: 'Analyze English, Chinese, Malay, or mixed-language messages with Gemini AI.',
      filterAll: 'All Messages',
      filterImportant: 'Important Only',
      filterUnread: 'Unread',
      pastePlaceholder: 'Paste a WeChat, WhatsApp, or email message (EN / 中文 / BM / Rojak)...',
      sourceLabel: 'Source App',
      senderLabel: 'Sender / Group',
      analyzeBtn: 'Analyze & Extract',
      analyzing: 'Analyzing with Gemini...',
      emptyTitle: 'Inbox is empty',
      emptyDesc: 'Capture a message, import a WhatsApp .txt export, or load sample trilingual messages to test extraction.',
      extractedEntities: 'Extracted Dates, Locations & People',
      linkedTasks: 'Identified Tasks & Events',
      originalText: 'Captured Text',
      redactedNote: 'Sensitive details automatically redacted before AI processing',
      pausedNotice: 'Source paused in Privacy Controls',
      blockedNotice: 'Sender is on your Privacy Blocklist',
    },
    tasks: {
      title: 'Assignments, Meetings & Tasks',
      subtitle: 'Deadline countdowns with direct traceability back to original messages.',
      all: 'All',
      assignment: 'Assignments',
      meeting: 'Meetings',
      task: 'Tasks',
      reminder: 'Reminders',
      pending: 'Open',
      completed: 'Completed',
      overdue: 'Overdue',
      dueToday: 'Due Today',
      sourceTrace: 'Source Message',
      emptyTitle: 'No matching items',
      emptyDesc: 'Add a task manually or analyze a message in Inbox to auto-extract assignments and meetings.',
    },
    calendar: {
      title: 'Calendar & Schedule',
      subtitle: 'Visual schedule for extracted meetings and deadlines, ready for Google Calendar or .ics export.',
      today: 'Today',
      noEventsDay: 'No meetings or deadlines scheduled for this date.',
      exportHint: 'Download an RFC 5545 .ics file to import into Google Calendar, Apple Calendar, or Outlook.',
    },
    chat: {
      title: 'AI Secretary Chat',
      subtitle: 'Ask in English, Chinese, or Malay. Grounded in your messages, deadlines, and personal memory.',
      placeholder: 'Ask about deadlines, schedule changes, or ask me to remember something...',
      quickPrompts: [
        'What are my most urgent deadlines this week?',
        '帮我总结一下最近收到的重要通知和日程变更',
        'Ada apa-apa perubahan jadual atau tugasan minggu ini?',
        'Check if any meetings conflict with my personal preferences.',
      ],
      clearChat: 'Clear Chat',
    },
    memory: {
      title: 'Personal Memory & Privacy',
      subtitle: 'Manage context Kairo remembers about you and control what data is processed.',
      memoryVault: 'Personal Memory Vault',
      privacyControls: 'Source & Privacy Controls',
      enabledSources: 'Authorized Message Sources',
      redactLabel: 'Redact phone numbers, IDs & OTP codes before AI analysis',
      redactDesc: 'Masks IC numbers, bank/OTP codes, and phone numbers locally on the server before sending text to Gemini.',
      storeRawLabel: 'Store original unredacted message snippet',
      storeRawDesc: 'When disabled, only the redacted version and AI summary are saved to disk.',
      blockedSenders: 'Blocked / Ignored Senders',
      blockedPlaceholder: 'Add sender name or group to ignore...',
      addBlocked: 'Block Sender',
      dataOwnership: 'Local Data Ownership (Personal MVP)',
    },
    android: {
      title: 'Android Notification Bridge',
      subtitle: 'Architecture handoff for native Kotlin NotificationListenerService integration.',
      limitationTitle: 'Important Platform Boundary: Web Preview vs. Native Android',
      limitationBody:
        'This application runs as a full-stack web workspace in Google AI Studio. Web browsers cannot access Android NotificationListenerService or capture background WeChat and WhatsApp notifications directly. Nothing here fakes background phone capture. Instead, the backend exposes the exact REST ingestion contract below, paired with ready-to-use Kotlin source files in /android-companion/ for your native Android build.',
      blueprintTitle: 'Kotlin Android Implementation Files',
      testEndpointTitle: 'Live Ingestion API Contract (POST /api/messages/ingest)',
    },
    common: {
      critical: 'Critical',
      high: 'High',
      normal: 'Normal',
      low: 'Low',
      noDate: 'No due date',
      location: 'Location',
      sender: 'Sender',
      source: 'Source',
      language: 'Language',
      loading: 'Loading...',
      themeLight: 'Light',
      themeDark: 'Dark',
    },
  },
  zh: {
    brandName: 'Kairo 私人秘书',
    nav: {
      overview: '总览简报',
      inbox: '消息收件箱',
      tasks: '任务与截止日',
      calendar: '日程日历',
      chat: 'AI 秘书对话',
      memory: '个人记忆与隐私',
      android: 'Android 原生桥接',
    },
    actions: {
      captureMessage: '录入消息',
      generateBriefing: '生成今日简报',
      runCrossAnalysis: '跨消息日程检查',
      addTask: '新建任务',
      addMemory: '添加记忆',
      exportIcs: '导出 .ics 日历',
      addToGoogleCal: '加入 Google 日历',
      applyChange: '应用日程变更',
      dismiss: '忽略',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      send: '发送',
      loadSamplePack: '载入三语测试消息',
      importChatLog: '导入 .txt 聊天记录',
      exportBackup: '导出 JSON 备份',
      resetWorkspace: '清空全部数据',
      enableBrowserAlerts: '开启桌面提醒',
    },
    overview: {
      title: '每日智能简报',
      subtitle: '跨微信、WhatsApp、邮件与个人记忆的中英马三语事务中枢。',
      briefingTitle: 'AI 每日简报',
      briefingEmpty: '今日尚未生成简报。点击生成，AI 将结合收件箱、任务截止日期和个人记忆为您汇总重点。',
      generatingBriefing: '正在生成简报...',
      urgentDeadlines: '紧急与近期截止事项',
      scheduleChanges: '跨消息检测到的日程变更',
      proactiveReminders: '主动提醒队列',
      statsActiveTasks: '待办事项',
      statsImportantMsgs: '重要消息',
      statsScheduleAlerts: '变更提醒',
      statsMemories: '个人记忆条目',
      topPriorities: '今日首要事项',
      todaySchedule: '日程与时间安排',
      watchouts: '冲突与注意事项',
    },
    inbox: {
      title: '消息收件箱与智能分诊',
      subtitle: '支持中文、英文、马来文及中英马混杂消息的 AI 摘要与实体提取。',
      filterAll: '全部消息',
      filterImportant: '仅看重要',
      filterUnread: '未读',
      pastePlaceholder: '粘贴微信、WhatsApp 或邮件消息（支持中文 / English / Melayu / 混杂语言）...',
      sourceLabel: '消息来源',
      senderLabel: '发送人 / 群聊',
      analyzeBtn: 'AI 分析并提取',
      analyzing: 'Gemini 正在解析...',
      emptyTitle: '收件箱暂无消息',
      emptyDesc: '请粘贴消息、导入 WhatsApp 导出的 .txt 记录，或载入三语测试消息体验提取效果。',
      extractedEntities: '提取的时间、地点与人物',
      linkedTasks: '识别出的任务与会议',
      originalText: '原始消息内容',
      redactedNote: '送入 AI 分析前已自动脱敏敏感信息',
      pausedNotice: '该消息来源已在隐私设置中暂停',
      blockedNotice: '该发送人位于隐私屏蔽名单中',
    },
    tasks: {
      title: '作业、会议与任务管理',
      subtitle: '实时倒计时追踪，每项任务均可溯源至原始消息。',
      all: '全部',
      assignment: '作业 / 报告',
      meeting: '会议',
      task: '待办任务',
      reminder: '提醒事项',
      pending: '进行中',
      completed: '已完成',
      overdue: '已逾期',
      dueToday: '今日截止',
      sourceTrace: '来源消息',
      emptyTitle: '暂无符合条件的事项',
      emptyDesc: '可手动新建任务，或在收件箱分析消息以自动识别任务与会议。',
    },
    calendar: {
      title: '日程与日历视图',
      subtitle: '集中展示识别出的会议与截止日期，支持一键添加至 Google 日历或导出 .ics 文件。',
      today: '今天',
      noEventsDay: '当天暂无已安排的会议或截止事项。',
      exportHint: '下载标准 RFC 5545 .ics 文件，可直接导入 Google Calendar、Apple 日历或 Outlook。',
    },
    chat: {
      title: 'AI 私人秘书对话',
      subtitle: '可用中文、英文或马来文提问，回答基于您的真实消息、任务与个人记忆。',
      placeholder: '询问本周截止日期、日程变更，或让我记住你的习惯...',
      quickPrompts: [
        '帮我总结一下今天和本周最紧急的截止事项',
        'What schedule changes were detected recently?',
        'Ada sebarang perubahan mesyuarat atau tugasan?',
        '检查我的日程是否与个人偏好冲突',
      ],
      clearChat: '清空对话',
    },
    memory: {
      title: '个人记忆库与隐私控制',
      subtitle: '管理 Kairo 记住的个人偏好与课程/联系人背景，并控制数据脱敏规则。',
      memoryVault: '个人记忆库',
      privacyControls: '来源授权与隐私控制',
      enabledSources: '已授权的消息来源类型',
      redactLabel: 'AI 分析前自动脱敏手机号、身份证号与验证码',
      redactDesc: '在服务器端先屏蔽 IC 号码、手机号与 OTP 验证码，再发送给 Gemini 进行摘要。',
      storeRawLabel: '保留未脱敏的原始消息文本',
      storeRawDesc: '关闭后，本地仅保存脱敏后的文本和 AI 摘要。',
      blockedSenders: '屏蔽的发送人 / 群组',
      blockedPlaceholder: '输入要忽略的发送人或群聊名称...',
      addBlocked: '加入屏蔽',
      dataOwnership: '个人本地数据主权（MVP 无商业化无广告）',
    },
    android: {
      title: 'Android 通知监听桥接方案',
      subtitle: '为未来原生 Kotlin NotificationListenerService 应用准备的完整工程架构。',
      limitationTitle: '技术边界说明：Web 预览版 vs 原生 Android 应用',
      limitationBody:
        '当前运行在 Google AI Studio 中的是全栈 Web MVP 应用。出于浏览器安全沙箱限制，网页端无法直接调用 Android 系统的 NotificationListenerService，也不能自动读取手机后台的微信或 WhatsApp 通知。本应用绝不会伪造后台抓包效果，而是为您提供真实可用的后端接口契约（POST /api/messages/ingest）以及可直接用于 Android Studio 的 Kotlin 源码。',
      blueprintTitle: 'Kotlin Android 原生监听源码（已同步生成至 /android-companion/）',
      testEndpointTitle: '实时接收接口规范 (POST /api/messages/ingest)',
    },
    common: {
      critical: '紧急',
      high: '重要',
      normal: '普通',
      low: '较低',
      noDate: '无截止日期',
      location: '地点',
      sender: '发送人',
      source: '来源',
      language: '语言',
      loading: '加载中...',
      themeLight: '浅色',
      themeDark: '深色',
    },
  },
  ms: {
    brandName: 'Kairo Setiausaha',
    nav: {
      overview: 'Ringkasan',
      inbox: 'Peti Masuk',
      tasks: 'Tugasan & Tarikh Akhir',
      calendar: 'Kalendar',
      chat: 'Pembantu AI',
      memory: 'Memori & Privasi',
      android: 'Jambatan Android',
    },
    actions: {
      captureMessage: 'Rekod Mesej',
      generateBriefing: 'Jana Taklimat',
      runCrossAnalysis: 'Analisis Silang Jadual',
      addTask: 'Tugasan Baru',
      addMemory: 'Tambah Memori',
      exportIcs: 'Eksport .ics',
      addToGoogleCal: 'Google Calendar',
      applyChange: 'Guna Kemaskini',
      dismiss: 'Abaikan',
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Padam',
      send: 'Hantar',
      loadSamplePack: 'Muat Mesej Contoh',
      importChatLog: 'Import Log .txt',
      exportBackup: 'Eksport JSON',
      resetWorkspace: 'Padam Semua Data',
      enableBrowserAlerts: 'Aktifkan Notifikasi',
    },
    overview: {
      title: 'Taklimat Eksekutif Harian',
      subtitle: 'Sintesis tiga bahasa merentasi mesej, tugasan, mesyuarat, dan memori peribadi anda.',
      briefingTitle: 'Taklimat AI Harian',
      briefingEmpty: 'Belum ada taklimat dijana hari ini. Jana taklimat berdasarkan peti masuk dan tarikh akhir anda.',
      generatingBriefing: 'Menjana taklimat...',
      urgentDeadlines: 'Tarikh Akhir Segera & Akan Datang',
      scheduleChanges: 'Perubahan Jadual Dikesan',
      proactiveReminders: 'Peringatan Proaktif',
      statsActiveTasks: 'Tugasan Aktif',
      statsImportantMsgs: 'Mesej Penting',
      statsScheduleAlerts: 'Amaran Jadual',
      statsMemories: 'Entri Memori',
      topPriorities: 'Keutamaan Utama',
      todaySchedule: 'Jadual & Masa',
      watchouts: 'Konflik & Perhatian',
    },
    inbox: {
      title: 'Peti Masuk & Penilaian Mesej',
      subtitle: 'Analisis mesej Bahasa Melayu, Inggeris, Cina, atau bahasa rojak menggunakan Gemini AI.',
      filterAll: 'Semua Mesej',
      filterImportant: 'Penting Sahaja',
      filterUnread: 'Belum Dibaca',
      pastePlaceholder: 'Tampal mesej WhatsApp, WeChat atau e-mel (BM / EN / 中文 / Rojak)...',
      sourceLabel: 'Sumber Aplikasi',
      senderLabel: 'Penghantar / Kumpulan',
      analyzeBtn: 'Analisis & Ekstrak',
      analyzing: 'Menganalisis dengan Gemini...',
      emptyTitle: 'Peti masuk kosong',
      emptyDesc: 'Tampal mesej, muat naik fail .txt WhatsApp, atau muatkan mesej contoh untuk menguji pengekstrakan AI.',
      extractedEntities: 'Tarikh, Lokasi & Individu Diekstrak',
      linkedTasks: 'Tugasan & Mesyuarat Dikenalpasti',
      originalText: 'Teks Mesej',
      redactedNote: 'Maklumat sensitif ditapis secara automatik sebelum analisis AI',
      pausedNotice: 'Sumber ini dijeda dalam Kawalan Privasi',
      blockedNotice: 'Penghantar berada dalam senarai sekat privasi',
    },
    tasks: {
      title: 'Tugasan, Mesyuarat & Tarikh Akhir',
      subtitle: 'Pemantauan tarikh akhir dengan pautan terus ke mesej sumber asal.',
      all: 'Semua',
      assignment: 'Tugasan Kuliah / Kerja',
      meeting: 'Mesyuarat',
      task: 'Kerja',
      reminder: 'Peringatan',
      pending: 'Aktif',
      completed: 'Selesai',
      overdue: 'Lewat Tempoh',
      dueToday: 'Tamat Hari Ini',
      sourceTrace: 'Mesej Sumber',
      emptyTitle: 'Tiada item sepadan',
      emptyDesc: 'Tambah tugasan secara manual atau analisis mesej di Peti Masuk.',
    },
    calendar: {
      title: 'Kalendar & Jadual',
      subtitle: 'Paparan jadual mesyuarat dan tarikh akhir dengan sokongan Google Calendar dan fail .ics.',
      today: 'Hari Ini',
      noEventsDay: 'Tiada mesyuarat atau tarikh akhir dijadualkan pada tarikh ini.',
      exportHint: 'Muat turun fail .ics RFC 5545 untuk diimport ke Google Calendar, Apple Calendar atau Outlook.',
    },
    chat: {
      title: 'Sembang Setiausaha AI',
      subtitle: 'Tanya dalam Bahasa Melayu, Inggeris atau Cina berdasarkan rekod mesej dan memori anda.',
      placeholder: 'Tanya tentang tarikh akhir, perubahan jadual, atau minta saya ingat maklumat...',
      quickPrompts: [
        'Apakah tarikh akhir paling penting minggu ini?',
        'Ada sebarang perubahan jadual mesyuarat atau kelas?',
        '帮我看看今天有什么重要的事情需要处理',
        'Check my schedule against my personal preferences.',
      ],
      clearChat: 'Kosongkan Sembang',
    },
    memory: {
      title: 'Memori Peribadi & Kawalan Privasi',
      subtitle: 'Urus konteks yang diingati Kairo dan kawal penapisan data peribadi anda.',
      memoryVault: 'Bilik Kebal Memori Peribadi',
      privacyControls: 'Kawalan Sumber & Privasi',
      enabledSources: 'Sumber Mesej Dibenarkan',
      redactLabel: 'Tapis nombor telefon, MyKad/IC & kod OTP sebelum analisis AI',
      redactDesc: 'Menyembunyikan maklumat sensitif di pelayan sebelum teks dihantar ke Gemini.',
      storeRawLabel: 'Simpan teks asal tanpa tapisan',
      storeRawDesc: 'Jika dimatikan, hanya versi bertapis dan ringkasan AI akan disimpan.',
      blockedSenders: 'Penghantar Disekat',
      blockedPlaceholder: 'Tambah nama penghantar atau kumpulan...',
      addBlocked: 'Sekat',
      dataOwnership: 'Pemilikan Data Tempatan (MVP Peribadi)',
    },
    android: {
      title: 'Jambatan Notifikasi Android',
      subtitle: 'Rangka kerja Kotlin NotificationListenerService untuk aplikasi Android asli masa depan.',
      limitationTitle: 'Had Platform: Aplikasi Web vs Android Asli',
      limitationBody:
        'Aplikasi ini dibina sebagai MVP web di Google AI Studio. Pelayar web tidak mempunyai akses kepada Android NotificationListenerService dan tidak boleh membaca notifikasi WeChat atau WhatsApp secara automatik di latar belakang. Tiada simulasi palsu digunakan. Sebaliknya, pelayan ini menyediakan kontrak API sebenar serta kod sumber Kotlin di /android-companion/ untuk projek Android anda.',
      blueprintTitle: 'Fail Implementasi Kotlin Android (/android-companion/)',
      testEndpointTitle: 'Kontrak API Penerimaan (POST /api/messages/ingest)',
    },
    common: {
      critical: 'Kritikal',
      high: 'Tinggi',
      normal: 'Biasa',
      low: 'Rendah',
      noDate: 'Tiada tarikh',
      location: 'Lokasi',
      sender: 'Penghantar',
      source: 'Sumber',
      language: 'Bahasa',
      loading: 'Memuatkan...',
      themeLight: 'Cerah',
      themeDark: 'Gelap',
    },
  },
};
