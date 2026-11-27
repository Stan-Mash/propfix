const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const parseDay = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

export const fmtDay = (iso, withYear = true) => {
  const dt = parseDay(iso);
  if (!dt) return '';
  return `${dt.getDate()} ${MON[dt.getMonth()]}${withYear ? ' ' + dt.getFullYear() : ''}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const completionDelta = (expected, actual) => {
  const e = parseDay(expected);
  const a = parseDay(actual);
  if (!e || !a) return '';
  const days = Math.round((e - a) / 86400000);
  if (days === 0) return 'On Time';
  const n = Math.abs(days);
  return `${n} Day${n !== 1 ? 's' : ''} ${days > 0 ? 'Early' : 'Late'}`;
};
