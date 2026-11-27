// PropFix — UI constants only. All demo data removed.

export const UNIT_COST_PER_M3 = 65; // KES per cubic metre of water

export const PROPERTIES = [];
export const UNITS = {};
export const MASTER_HISTORY = {};
export const RENT_COLLECTED = {};
export const RENT_ROLL = {};
export const TICKETS = [];
export const CONTRACTORS = {};
export const STAFF = { managers: [], caretakers: [] };
export const USERS = {};

export const getMasterMeterVariance = () => null;

export const STATUS_LABELS = {
  reported:           'Reported',
  quotes_uploaded:    'Quotes Uploaded',
  awaiting_approval:  'Awaiting Approval',
  approved:           'Approved',
  in_progress:        'In Progress',
  completed:          'Completed',
  rejected:           'Rejected',
};

export const STATUS_COLORS = {
  reported:           { text: '#92400E', bg: '#FEF3C7', border: '#F59E0B' },
  quotes_uploaded:    { text: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD' },
  awaiting_approval:  { text: '#92400E', bg: '#FEF3C7', border: '#F59E0B' },
  approved:           { text: '#065F46', bg: '#D1FAE5', border: '#6EE7B7' },
  in_progress:        { text: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD' },
  completed:          { text: '#065F46', bg: '#D1FAE5', border: '#6EE7B7' },
  rejected:           { text: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
};

export const PRIORITY_COLORS = {
  Routine:   { text: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  Urgent:    { text: '#92400E', bg: '#FEF3C7', border: '#F59E0B' },
  Emergency: { text: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
};

export const CATEGORY_ICONS = {
  Plumbing:   'plumbing',
  Electrical: 'electrical-services',
  Masonry:    'foundation',
  Carpentry:  'handyman',
  Painting:   'format-paint',
};

export const CATEGORY_COLORS = {
  Plumbing:   '#2563EB',
  Electrical: '#D97706',
  Masonry:    '#7C3AED',
  Carpentry:  '#D97706',
  Painting:   '#0891B2',
};

export const UNIT_STATUS = {
  occupied:     { label: 'Occupied',     text: '#065F46', bg: '#D1FAE5', border: '#6EE7B7' },
  on_notice:    { label: 'On Notice',    text: '#92400E', bg: '#FEF3C7', border: '#F59E0B' },
  under_repair: { label: 'Under Repair', text: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD' },
  vacant:       { label: 'Vacant',       text: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
};
