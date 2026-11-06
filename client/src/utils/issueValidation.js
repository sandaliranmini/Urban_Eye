import { LIMITS } from '../constants/issueConstants';

export function validateStep(step, form) {
  const e = {};
  if (step === 0) {
    const title = form.title.trim();
    if (title.length < LIMITS.TITLE_MIN) e.title = `Title must be at least ${LIMITS.TITLE_MIN} characters`;
    if (form.description.trim().length < LIMITS.DESC_MIN)
      e.description = `Please describe the problem in at least ${LIMITS.DESC_MIN} characters`;
  }
  if (step === 1 && !form.category) e.category = 'Please choose a category';
  if (step === 2 && !form.ward_id) e.ward_id = 'Please select your ward';
  if (step === 3 && !form.photo) e.photo = 'Please add a photo as evidence';
  return e;
}