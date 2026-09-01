const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES: { [key: string]: string } = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
  'sun': 'Sunday',
  'mon': 'Monday',
  'tue': 'Tuesday',
  'wed': 'Wednesday',
  'thu': 'Thursday',
  'fri': 'Friday',
  'sat': 'Saturday'
};

function getOrdinalSuffix(n: number): string {
  if (isNaN(n)) return '';
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatTime(hourStr: string, minStr: string): string {
  const h = parseInt(hourStr, 10);
  const m = parseInt(minStr, 10);
  if (isNaN(h) || isNaN(m)) return `${hourStr}:${minStr}`;
  const hPad = h.toString().padStart(2, '0');
  const mPad = m.toString().padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hPad}:${mPad} (${h12}:${mPad} ${ampm})`;
}

export function formatCronDescription(cron: string): string {
  if (!cron || typeof cron !== 'string') return cron || '';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [min, hour, dom, month, dow] = parts;

  // Case: Every N minutes (*/N * * * *)
  if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = min.slice(2);
    return `Every ${n} minute${n === '1' ? '' : 's'}`;
  }

  // Case: Every minute (* * * * *)
  if (min === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every minute';
  }

  // Case: Hourly at specified minute (M * * * *)
  if (!min.includes('*') && !min.includes('/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const m = parseInt(min, 10);
    return m === 0 ? 'Hourly (on the hour)' : `Hourly (at minute ${m})`;
  }

  // Case: Every N hours (0 */N * * *)
  if (!min.includes('*') && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    const n = hour.slice(2);
    const mPad = min.padStart(2, '0');
    return `Every ${n} hours (at :${mPad})`;
  }

  // Case: Specific Month and Day of Month (e.g. 5 2 31 8 *)
  if (!min.includes('*') && !hour.includes('*') && dom !== '*' && month !== '*' && dow === '*') {
    const mNum = parseInt(month, 10);
    const monthName = !isNaN(mNum) && mNum >= 1 && mNum <= 12 ? MONTHS[mNum - 1] : `Month ${month}`;
    const domNum = parseInt(dom, 10);
    const domStr = !isNaN(domNum) ? `${domNum}${getOrdinalSuffix(domNum)}` : dom;
    return `Every year on ${monthName} ${domStr} at ${formatTime(hour, min)}`;
  }

  // Case: Specific Day of Month (e.g. 0 8 1 * *)
  if (!min.includes('*') && !hour.includes('*') && dom !== '*' && month === '*' && dow === '*') {
    const days = dom.split(',').map(d => {
      const dNum = parseInt(d, 10);
      return !isNaN(dNum) ? `${dNum}${getOrdinalSuffix(dNum)}` : d;
    }).join(', ');
    return `Monthly on the ${days} at ${formatTime(hour, min)}`;
  }

  // Case: Weekdays (0 9 * * 1-5 or mon-fri)
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && month === '*' && (dow === '1-5' || dow.toLowerCase() === 'mon-fri')) {
    return `Weekdays (Mon-Fri) at ${formatTime(hour, min)}`;
  }

  // Case: Weekends (0 9 * * 0,6 or 6,0 or sat,sun)
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && month === '*' && (dow === '0,6' || dow === '6,0' || dow.toLowerCase() === 'sat,sun')) {
    return `Weekends (Sat-Sun) at ${formatTime(hour, min)}`;
  }

  // Case: Specific Days of Week (0 9 * * 1,3,5 or 0 9 * * 0)
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && month === '*' && dow !== '*') {
    const days = dow.split(',').map(d => DAY_NAMES[d.toLowerCase()] || d).join(', ');
    return `Every ${days} at ${formatTime(hour, min)}`;
  }

  // Case: Daily (0 8 * * *)
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && month === '*' && dow === '*') {
    return `Daily at ${formatTime(hour, min)}`;
  }

  return `Custom schedule: ${cron}`;
}
