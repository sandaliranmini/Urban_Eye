export const STEPS = ['Details', 'Category', 'Ward', 'Photo', 'Review'];

export const CATEGORIES = [
  { value: 'Road Hazard',      hint: 'Potholes, broken roads, fallen trees' },
  { value: 'Water Drainage',   hint: 'Blocked drains, leaks, flooding' },
  { value: 'Waste Management', hint: 'Uncollected or dumped garbage' },
  { value: 'Street Lighting',  hint: 'Broken or missing street lights' },
  { value: 'Other',            hint: 'Anything else that needs attention' },
];

export const LIMITS = { TITLE_MIN: 5, TITLE_MAX: 150, DESC_MIN: 20, DESC_MAX: 2000 };
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_MB = 5;