const STORAGE_KEY = 'summit-crm-form-urls';

const defaultConfig = {
  bookCallFormUrl: '',
  closeDealFormUrl: '',
  eodReportFormUrl: '',
};

export function getFormConfig() {
  if (typeof window === 'undefined') return defaultConfig;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultConfig, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Failed to read form config:', e);
  }
  return defaultConfig;
}

export function saveFormConfig(config) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save form config:', e);
  }
}
