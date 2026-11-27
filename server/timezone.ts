export const KUALA_LUMPUR_TZ = 'Asia/Kuala_Lumpur';

interface KualaLumpurParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
  isoDate: string;
  time24: string;
  isoOffset: string;
}

export function getKualaLumpurParts(date: Date = new Date()): KualaLumpurParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KUALA_LUMPUR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour === '24' ? '0' : map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;
  const time24 = `${pad(hour)}:${pad(minute)}`;
  const isoOffset = `${isoDate}T${time24}:${pad(second)}+08:00`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: map.weekday || 'Monday',
    isoDate,
    time24,
    isoOffset,
  };
}

export function getTodayIsoMYT(): string {
  return getKualaLumpurParts().isoDate;
}

export function addDaysIsoMYT(offsetDays: number, baseDate: Date = new Date()): string {
  const today = getKualaLumpurParts(baseDate);
  const shifted = new Date(Date.UTC(today.year, today.month - 1, today.day + offsetDays, 12, 0, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function formatTimestampMYT(isoInput: string): string {
  const parsed = Date.parse(isoInput);
  if (Number.isNaN(parsed)) {
    return `${getKualaLumpurParts().isoDate} ${getKualaLumpurParts().time24} MYT (+08:00)`;
  }
  const p = getKualaLumpurParts(new Date(parsed));
  return `${p.isoDate} (${p.weekday}) ${p.time24} MYT (+08:00)`;
}
