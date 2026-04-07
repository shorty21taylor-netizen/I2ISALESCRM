var STORAGE_KEY = 'summit-crm-whatsapp-config';

var defaultConfig = {
  assistroApiUrl: '',
  assistroApiKey: '',
  whatsappGroupId: '',
  adminPhone: '',
  adminGroupId: '',
  timezone: 'America/New_York',
  crmUrl: '',
  schedulerEnabled: true,

  // Per-form instant notification groups (enabled by default — toggle OFF to disable)
  bookedCallGroupId: '',
  bookedCallEnabled: true,
  closedDealGroupId: '',
  closedDealEnabled: true,
  eodReportGroupId: '',
  eodReportEnabled: true,

  // Scheduled message destinations
  eodReminderEnabled: true,
  eodReminderGroupId: '',
  morningDigestEnabled: true,
  morningDigestGroupId: '',
  adminMorningReportEnabled: true,
  adminMorningReportPhone: '',
  adminMorningReportGroupId: '',
};

export function getFormConfig() {
  if (typeof window === 'undefined') return defaultConfig;
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      var result = {};
      var keys = Object.keys(defaultConfig);
      for (var i = 0; i < keys.length; i++) {
        result[keys[i]] = parsed[keys[i]] !== undefined ? parsed[keys[i]] : defaultConfig[keys[i]];
      }
      return result;
    }
  } catch (e) {
    console.error('Failed to read config:', e);
  }
  return defaultConfig;
}

export function saveFormConfig(config) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}
