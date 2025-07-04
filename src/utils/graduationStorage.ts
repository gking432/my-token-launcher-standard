import { GraduationAttempt } from '../types/graduation';

const GRADUATION_STORAGE_KEY = 'pending_graduations';

export const saveGraduationAttempt = (attempt: GraduationAttempt) => {
  const existing = getPendingGraduations();
  existing[attempt.metadata_addr] = attempt;
  localStorage.setItem(GRADUATION_STORAGE_KEY, JSON.stringify(existing));
};

export const getPendingGraduations = (): Record<string, GraduationAttempt> => {
  const stored = localStorage.getItem(GRADUATION_STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const clearGraduationAttempt = (metadata_addr: string) => {
  const existing = getPendingGraduations();
  delete existing[metadata_addr];
  localStorage.setItem(GRADUATION_STORAGE_KEY, JSON.stringify(existing));
};

export const updateGraduationAttempt = (metadata_addr: string, updates: Partial<GraduationAttempt>) => {
  const existing = getPendingGraduations();
  if (existing[metadata_addr]) {
    existing[metadata_addr] = { ...existing[metadata_addr], ...updates };
    localStorage.setItem(GRADUATION_STORAGE_KEY, JSON.stringify(existing));
  }
}; 