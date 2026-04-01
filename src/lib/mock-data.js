export const closers = [
  { id: 'c1', name: 'Marcus Johnson', email: 'marcus@summit.com', role: 'closer', status: 'active', joinedAt: '2025-09-15' },
  { id: 'c2', name: 'Aisha Williams', email: 'aisha@summit.com', role: 'closer', status: 'active', joinedAt: '2025-10-01' },
  { id: 'c3', name: 'Jordan Rivera', email: 'jordan@summit.com', role: 'closer', status: 'active', joinedAt: '2025-08-20' },
  { id: 'c4', name: 'Derek Chen', email: 'derek@summit.com', role: 'closer', status: 'active', joinedAt: '2025-11-01' },
  { id: 'c5', name: 'Tanya Brooks', email: 'tanya@summit.com', role: 'setter', status: 'active', joinedAt: '2025-10-15' },
];

export const teamOverview = {
  totalRevenue: 187450, revenueTrend: 12.3, totalCloses: 47, closesTrend: 8.1,
  teamCloseRate: 34.2, closeRateTrend: 2.4, totalDials: 2840, dialsTrend: -3.2,
  avgDealValue: 3988, dealValueTrend: 5.7, inboundRevenue: 112470, outboundRevenue: 74980,
  activeClosers: 5, eodComplianceRate: 91.4,
};

export const closerPerformances = [
  { closer: closers[0], period: '30d', totalDials: 680, connectRate: 28.4, dialToBookRatio: 12.1, showRate: 78.5, closeRate: 41.2, avgDealValue: 4250, totalRevenue: 59500, revenuePerDial: 87.5, dialsTrend: 5.2, closeRateTrend: 3.8, revenueTrend: 18.4, aiDiagnostic: 'Top performer this month. Strong discovery process and objection handling. Recommend routing high-value inbound leads to Marcus.', aiSuggestions: ['Route premium leads to this closer', 'Have Marcus lead next team training on discovery framework'] },
  { closer: closers[1], period: '30d', totalDials: 720, connectRate: 31.2, dialToBookRatio: 10.8, showRate: 82.1, closeRate: 37.8, avgDealValue: 3800, totalRevenue: 49400, revenuePerDial: 68.6, dialsTrend: 8.4, closeRateTrend: 1.2, revenueTrend: 9.7, aiDiagnostic: 'Highest connect rate on the team. Offers being made too early before full pain discovery.', aiSuggestions: ['Extend discovery phase by 2-3 minutes', 'Use more tie-down questions before presenting offer'] },
  { closer: closers[2], period: '30d', totalDials: 540, connectRate: 24.1, dialToBookRatio: 15.3, showRate: 65.2, closeRate: 38.9, avgDealValue: 4100, totalRevenue: 45100, revenuePerDial: 83.5, dialsTrend: -12.5, closeRateTrend: -2.1, revenueTrend: -8.3, funnelBottleneck: 'Show Rate \u2014 65.2% vs team avg 76.8%', aiDiagnostic: 'Declining dial volume. Show rate at 65.2% is the bottleneck. 3 missing EOD reports this month.', aiSuggestions: ['Audit confirmation sequence', 'Set minimum 30/day dial target', 'Review EOD compliance'] },
  { closer: closers[3], period: '30d', totalDials: 580, connectRate: 22.8, dialToBookRatio: 18.2, showRate: 71.4, closeRate: 24.6, avgDealValue: 3650, totalRevenue: 21900, revenuePerDial: 37.8, dialsTrend: 2.1, closeRateTrend: -5.8, revenueTrend: -14.2, funnelBottleneck: 'Close Rate \u2014 24.6% vs team avg 34.2%', aiDiagnostic: 'Struggling on the close. Talk-to-listen ratio is 62/38. Price objections not reframed effectively.', aiSuggestions: ['Review last 5 lost calls with Marcus', 'Practice price objection reframes', 'Target 45/55 talk ratio'] },
  { closer: closers[4], period: '30d', totalDials: 320, connectRate: 35.6, dialToBookRatio: 8.4, showRate: 88.2, closeRate: 29.4, avgDealValue: 3750, totalRevenue: 11550, revenuePerDial: 36.1, dialsTrend: -1.8, closeRateTrend: 4.2, revenueTrend: 6.1, aiDiagnostic: 'Setting metrics are excellent. Closing improving month-over-month. Strong candidate for full closer role.', aiSuggestions: ['Continue developing closing skills', 'Shadow Marcus on 2 calls this week'] },
];

export const recentEODs = [
  { id: 'eod-1', closerId: 'c1', closerName: 'Marcus Johnson', date: '2026-03-31', submittedAt: '2026-03-31T18:12:00Z', totalDials: 34, connects: 9, callsBooked: 3, callsTaken: 5, closes: 2, cashCollected: 8500, pipelineNotes: '2 hot leads in pipeline from last week.', biggestWin: 'Closed $5,500 deal with referral', biggestLoss: 'Lost deal on price', confidenceScore: 8, status: 'submitted' },
  { id: 'eod-2', closerId: 'c2', closerName: 'Aisha Williams', date: '2026-03-31', submittedAt: '2026-03-31T18:45:00Z', totalDials: 38, connects: 12, callsBooked: 4, callsTaken: 4, closes: 1, cashCollected: 3800, pipelineNotes: 'Booked 4 calls for tomorrow.', biggestWin: 'Booked 4 calls in one session', biggestLoss: 'No-show from confident lead', confidenceScore: 7, status: 'submitted' },
  { id: 'eod-3', closerId: 'c3', closerName: 'Jordan Rivera', date: '2026-03-31', submittedAt: '2026-03-31T20:30:00Z', totalDials: 22, connects: 5, callsBooked: 1, callsTaken: 3, closes: 1, cashCollected: 4100, pipelineNotes: 'Slow dial day.', biggestWin: 'Closed outbound ghost lead', biggestLoss: 'Two no-shows back to back', confidenceScore: 5, status: 'late' },
  { id: 'eod-4', closerId: 'c4', closerName: 'Derek Chen', date: '2026-03-31', submittedAt: '', totalDials: 0, connects: 0, callsBooked: 0, callsTaken: 0, closes: 0, cashCollected: 0, pipelineNotes: '', biggestWin: '', biggestLoss: '', confidenceScore: 0, status: 'missing' },
  { id: 'eod-5', closerId: 'c5', closerName: 'Tanya Brooks', date: '2026-03-31', submittedAt: '2026-03-31T17:55:00Z', totalDials: 18, connects: 7, callsBooked: 2, callsTaken: 2, closes: 1, cashCollected: 3750, pipelineNotes: 'Both booked calls from IG ads.', biggestWin: 'Closed my first outbound deal!', biggestLoss: 'Prospect ghosted', confidenceScore: 9, status: 'submitted' },
];

export const recentCalls = [
  { id: 'call-1', closerId: 'c1', closerName: 'Marcus Johnson', leadName: 'Sarah Mitchell', leadSource: 'inbound', date: '2026-03-31T14:00:00Z', duration: 2280, outcome: 'closed', dealValue: 5500, fathomRecordingUrl: 'https://fathom.video/call/abc123', talkToListenRatio: 42, aiScorecard: { overallScore: 92, discoveryDone: true, objectionHandling: 9, urgencyCreated: true, closingAttempt: true, sentimentTrend: 'positive', objectionsRaised: ['Price concern', 'Timeline'], summary: 'Excellent discovery. Handled price objection with ROI reframe. Clean close.' } },
  { id: 'call-2', closerId: 'c2', closerName: 'Aisha Williams', leadName: 'James Taylor', leadSource: 'inbound', date: '2026-03-31T15:30:00Z', duration: 1920, outcome: 'no-close', fathomRecordingUrl: 'https://fathom.video/call/def456', talkToListenRatio: 58, aiScorecard: { overallScore: 61, discoveryDone: true, objectionHandling: 5, urgencyCreated: false, closingAttempt: true, sentimentTrend: 'declining', objectionsRaised: ['Need to think about it', 'Spouse approval'], summary: 'Transitioned to offer too quickly. No urgency created.' } },
  { id: 'call-3', closerId: 'c4', closerName: 'Derek Chen', leadName: 'Maria Lopez', leadSource: 'outbound', date: '2026-03-31T11:00:00Z', duration: 1440, outcome: 'no-close', fathomRecordingUrl: 'https://fathom.video/call/ghi789', talkToListenRatio: 65, aiScorecard: { overallScore: 44, discoveryDone: false, objectionHandling: 4, urgencyCreated: false, closingAttempt: true, sentimentTrend: 'declining', objectionsRaised: ['Too expensive', 'Bad timing'], summary: 'Skipped discovery. Talk ratio 65% too high. Needs coaching.' } },
  { id: 'call-4', closerId: 'c3', closerName: 'Jordan Rivera', leadName: 'Kevin Wright', leadSource: 'outbound', date: '2026-03-31T13:00:00Z', duration: 2640, outcome: 'closed', dealValue: 4100, fathomRecordingUrl: 'https://fathom.video/call/jkl012', talkToListenRatio: 38, aiScorecard: { overallScore: 87, discoveryDone: true, objectionHandling: 8, urgencyCreated: true, closingAttempt: true, sentimentTrend: 'positive', objectionsRaised: ['Need references'], summary: 'Strong re-engagement of ghost lead. Closed on second attempt.' } },
  { id: 'call-5', closerId: 'c5', closerName: 'Tanya Brooks', leadName: 'David Kim', leadSource: 'inbound', date: '2026-03-31T16:00:00Z', duration: 1800, outcome: 'closed', dealValue: 3750, fathomRecordingUrl: 'https://fathom.video/call/mno345', talkToListenRatio: 44, aiScorecard: { overallScore: 78, discoveryDone: true, objectionHandling: 7, urgencyCreated: true, closingAttempt: true, sentimentTrend: 'positive', objectionsRaised: ['Not sure if right fit'], summary: 'Solid call. First outbound close \u2014 showing real growth.' } },
];

export const revenueByDay = [
  { date: 'Mar 18', revenue: 7200, closes: 2 }, { date: 'Mar 19', revenue: 11500, closes: 3 },
  { date: 'Mar 20', revenue: 4100, closes: 1 }, { date: 'Mar 21', revenue: 15800, closes: 4 },
  { date: 'Mar 22', revenue: 0, closes: 0 }, { date: 'Mar 23', revenue: 0, closes: 0 },
  { date: 'Mar 24', revenue: 8400, closes: 2 }, { date: 'Mar 25', revenue: 12300, closes: 3 },
  { date: 'Mar 26', revenue: 19600, closes: 5 }, { date: 'Mar 27', revenue: 7500, closes: 2 },
  { date: 'Mar 28', revenue: 3800, closes: 1 }, { date: 'Mar 29', revenue: 0, closes: 0 },
  { date: 'Mar 30', revenue: 0, closes: 0 }, { date: 'Mar 31', revenue: 20150, closes: 4 },
];

export const dialsByCloser = [
  { date: 'Mar 25', Marcus: 32, Aisha: 36, Jordan: 28, Derek: 30, Tanya: 16 },
  { date: 'Mar 26', Marcus: 35, Aisha: 40, Jordan: 30, Derek: 28, Tanya: 18 },
  { date: 'Mar 27', Marcus: 30, Aisha: 34, Jordan: 18, Derek: 32, Tanya: 15 },
  { date: 'Mar 28', Marcus: 36, Aisha: 38, Jordan: 24, Derek: 29, Tanya: 17 },
  { date: 'Mar 29', Marcus: 0, Aisha: 0, Jordan: 0, Derek: 0, Tanya: 0 },
  { date: 'Mar 30', Marcus: 0, Aisha: 0, Jordan: 0, Derek: 0, Tanya: 0 },
  { date: 'Mar 31', Marcus: 34, Aisha: 38, Jordan: 22, Derek: 28, Tanya: 18 },
];
