var STORAGE_KEY = 'summit-crm-whatsapp-config';

var defaultConfig = {
  assistroApiUrl: '',
  assistroApiKey: '',
  whatsappGroupId: '',
  adminPhone: '',
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

  // Partner brands for the program selector
  partners: ['Jmapie', 'Mo', 'Ty and Keisha', 'Carrington'],
};

var DEFAULT_PARTNERS = ['Jmapie', 'Mo', 'Ty and Keisha', 'Carrington'];

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

export function getPartners() {
  var cfg = getFormConfig();
  return (cfg.partners && cfg.partners.length) ? cfg.partners : DEFAULT_PARTNERS.slice();
}

export function addPartner(name) {
  var cfg = getFormConfig();
  if (!cfg.partners || !cfg.partners.length) cfg.partners = DEFAULT_PARTNERS.slice();
  if (!cfg.partners.includes(name)) cfg.partners.push(name);
  saveFormConfig(cfg);
  return cfg.partners;
}

export function removePartner(name) {
  var cfg = getFormConfig();
  if (!cfg.partners) return DEFAULT_PARTNERS.slice();
  cfg.partners = cfg.partners.filter(function(p) { return p !== name; });
  saveFormConfig(cfg);
  return cfg.partners;
}
