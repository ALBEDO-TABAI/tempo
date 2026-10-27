// UI strings (Tempo's own). Keys are flat; {x} placeholders.
export type Locale = 'en' | 'zh-TW' | 'zh-CN';
const en = {
  today: 'Today', day: 'Day', week: 'Week', month: 'Month', days: 'Days', nDays: '{n} days', viewSettings: 'View settings',
  showWeekends: 'Show weekends', showDeclined: 'Show declined events', showWeekNumbers: 'Show week numbers',
  allDay: 'All-day', noTitle: '(No title)', newEvent: 'New event', search: 'Search events', searchShortcuts: 'Search shortcuts',
  usefulShortcuts: 'Useful shortcuts', commandMenu: 'Command menu', toggleSidebar: 'Toggle sidebar', goToDate: 'Go to date',
  allShortcuts: 'All keyboard shortcuts', calendars: 'Calendars', addCalendar: 'Add calendar', importIcs: 'Import .ics…', exportIcs: 'Export .ics…',
  local: 'On this Mac', defaultTag: 'Default', typeCommand: 'Type a command…', navigate: 'Navigate', select: 'Select', close: 'Close',
  secCalendar: 'Calendar', secNavigation: 'Navigation', secView: 'View', secPrefs: 'Preferences', secEvent: 'Event',
  createEvent: 'Create event…', goToday: 'Go to today', nextPeriod: 'Go to next period', prevPeriod: 'Go to previous period',
  switchDay: 'Switch to day view', switchWeek: 'Switch to week view', switchMonth: 'Switch to month view', switchNDays: 'Switch to {n}-day view',
  zoomIn: 'Zoom hours in', zoomOut: 'Zoom hours out', zoomReset: 'Default hour size', toggleTheme: 'Toggle light / dark theme',
  openSettings: 'Open settings', toggleAllDay: 'Collapse / expand all-day section', deleteEvent: 'Delete event', duplicateEvent: 'Duplicate event',
  settings: 'Settings', general: 'General', profile: 'Profile', notifications: 'Notifications', menuBar: 'Menu bar', appearance: 'Appearance',
  calendarView: 'Calendar view', weekStartsOn: 'Start week on', timeFormat: 'Time format', h12: '12-hour', h24: '24-hour',
  theme: 'Theme', themeSystem: 'Use system setting', themeLight: 'Light', themeDark: 'Dark', language: 'Language',
  timeZones: 'Time zones', primaryTz: 'Primary time zone', addTz: 'Add time zone', defaultDuration: 'Default event duration', minutes: '{n} minutes',
  reminders: 'Reminders', eventColor: 'Event color', calendarColor: 'Calendar color', addReminder: 'Add reminder', minutesBefore: '{n} min before', hoursBefore: '{n} h before', daysBefore: '{n} d before', atStart: 'At start of event',
  participants: 'Participants', addParticipants: 'Add participants', location: 'Location', description: 'Description', conferencing: 'Video call', addLink: 'Add link or attachment',
  busy: 'Busy', free: 'Free', defaultVisibility: 'Default visibility', publicV: 'Public', privateV: 'Private',
  repeat: 'Repeat', timeZone: 'Time zone', doesNotRepeat: 'Does not repeat', daily: 'Every day', weekly: 'Every week on {d}', weekdays: 'Every weekday (Mon–Fri)',
  monthly: 'Every month on day {n}', yearly: 'Every year on {d}', custom: 'Custom…', event: 'Event', shareAvail: 'Share availability', availHint: 'Drag on the calendar to add times, or fill in your free time.', fillFree: 'Fill free time', copyText: 'Copy as text', createHolds: 'Create holds', clearAll: 'Clear', availCopied: 'Availability copied', availIntro: 'Here are some times that work for me ({tz}):', holdTitle: 'Hold', holdsCreated: 'Created {n} holds', noSlots: 'No times selected', exitAvail: 'Done', customRepeat: 'Custom repeat', every: 'Every', uDay: 'day', uWeek: 'week', uMonth: 'month', uYear: 'year', uDays: 'days', uWeeks: 'weeks', uMonths: 'months', uYears: 'years', repeatOn: 'Repeat on', ends: 'Ends', never: 'Never', onDate: 'On', after: 'After', occurrencesN: 'occurrences', done: 'Done', cancel: 'Cancel', monthDayN: 'Monthly on day {n}', monthNth: 'Monthly on the {o} {d}', ordN: 'first|second|third|fourth|last', ruleEvery: 'Every {n} {u}', ruleOn: ' on {d}', ruleCount: ', {n} times', ruleUntil: ', until {d}',
  cut: 'Cut', copy: 'Copy', paste: 'Paste', duplicate: 'Duplicate', del: 'Delete', deleteKey: 'Delete', changeColor: 'Color',
  undo: 'Undo', deleted: 'Event deleted', moved: 'Event moved', created: 'Event created', imported: 'Imported {n} events', updated: 'Event updated',
  thisEvent: 'This event', thisAndFollowing: 'This and following events', allEvents: 'All events', editRecurring: 'Edit recurring event', deleteRecurring: 'Delete recurring event',
  noResults: 'No results', events: 'Events', upcoming: 'Upcoming', past: 'Past', mon: 'Monday', sun: 'Sunday', sat: 'Saturday',
  rsvpGoing: 'Going?', yes: 'Yes', no: 'No', maybe: 'Maybe', organizer: 'Organizer', more: '{n} more', week_n: 'W{n}',
  shortcutsGeneral: 'General', shortcutsViews: 'Views', shortcutsNav: 'Navigation', shortcutsEvents: 'Events', shortcutsGrid: 'Grid',
  sCreate: 'Create event', sSearch: 'Search', sSave: 'Save / confirm', sEsc: 'Close or go back', sSelectAll: 'Select all visible',
  sDelete: 'Delete', sDeleteNow: 'Delete immediately', sCut: 'Cut', sCopy: 'Copy', sDuplicate: 'Duplicate', sPaste: 'Paste', sUndo: 'Undo', sRedo: 'Redo',
  sDay: 'Day', sWeek: 'Week', sMonth: 'Month', sNDays: '2–9 days', sToday: 'Today', sNext: 'Next period', sPrev: 'Previous period',
  sZoomIn: 'Zoom in', sZoomOut: 'Zoom out', sZoomReset: 'Reset zoom', sAllDay: 'Toggle all-day section', sTheme: 'Toggle theme', sSettings: 'Settings',
  sShortcuts: 'Keyboard shortcuts', sSidebar: 'Toggle sidebar', sPanel: 'Toggle side panel', or: 'or', drag: 'drag',
  welcome: 'Welcome to Tempo', quit: 'Quit Tempo', nextEvent: 'Next: {t}', cardJoin: 'Join', cardOpen: 'Open', cardDismiss: 'Dismiss', startsNow: 'Starting now', startsIn: 'In {n} min', noUpcoming: 'No upcoming events',
  newCalendar: 'New calendar', rename: 'Rename', hideCal: 'Hide', showCal: 'Show', onlyThis: 'Show only this calendar', deleteCalendar: 'Delete calendar',
  jumpTo: 'Jump to', enterDate: 'Type a date, e.g. 2026-11-03', durationMin: '{n} min', durationH: '{n} h', durationHM: '{h} h {m} min', declined: 'Declined',
} as const;
type Dict = { [K in keyof typeof en]: string };
const zhTW: Dict = {
  today: '今天', day: '天', week: '週', month: '月', days: '天數', nDays: '{n} 天', viewSettings: '檢視設定',
  showWeekends: '顯示週末', showDeclined: '顯示已拒絕的活動', showWeekNumbers: '顯示週數',
  allDay: '全天', noTitle: '(無標題)', newEvent: '新活動', search: '搜尋活動', searchShortcuts: '搜尋快速鍵',
  usefulShortcuts: '常用快速鍵', commandMenu: '指令選單', toggleSidebar: '切換側邊欄', goToDate: '前往日期',
  allShortcuts: '所有快速鍵', calendars: '日曆', addCalendar: '新增日曆', importIcs: '匯入 .ics…', exportIcs: '匯出 .ics…',
  local: '這台 Mac 上', defaultTag: '預設', typeCommand: '輸入指令…', navigate: '導覽', select: '選取', close: '關閉',
  secCalendar: '日曆', secNavigation: '導覽', secView: '檢視', secPrefs: '偏好設定', secEvent: '活動',
  createEvent: '建立活動…', goToday: '前往今天', nextPeriod: '前往下一期間', prevPeriod: '前往上一期間',
  switchDay: '切換到日檢視', switchWeek: '切換到週檢視', switchMonth: '切換到月檢視', switchNDays: '切換到 {n} 天檢視',
  zoomIn: '放大時段', zoomOut: '縮小時段', zoomReset: '預設時段大小', toggleTheme: '切換淺色 / 深色主題',
  openSettings: '開啟設定', toggleAllDay: '收合 / 展開全天區', deleteEvent: '刪除活動', duplicateEvent: '複製活動',
  settings: '設定', general: '一般', profile: '個人資料', notifications: '通知', menuBar: '選單列', appearance: '外觀',
  calendarView: '日曆檢視', weekStartsOn: '每週開始於', timeFormat: '時間格式', h12: '12 小時制', h24: '24 小時制',
  theme: '主題', themeSystem: '跟隨系統', themeLight: '淺色', themeDark: '深色', language: '語言',
  timeZones: '時區', primaryTz: '主要時區', addTz: '新增時區', defaultDuration: '預設活動長度', minutes: '{n} 分鐘',
  reminders: '提醒事項', eventColor: '活動顏色', calendarColor: '日曆顏色', addReminder: '新增提醒', minutesBefore: '{n} 分鐘前', hoursBefore: '{n} 小時前', daysBefore: '{n} 天前', atStart: '活動開始時',
  participants: '參與者', addParticipants: '新增參與者', location: '地點', description: '說明', conferencing: '視訊通話', addLink: '新增連結或附件',
  busy: '忙碌', free: '有空', defaultVisibility: '預設可見度', publicV: '公開', privateV: '私人',
  repeat: '重複', timeZone: '時區', doesNotRepeat: '不重複', daily: '每天', weekly: '每週{d}', weekdays: '每個工作日(週一至週五)',
  monthly: '每月 {n} 日', yearly: '每年 {d}', custom: '自訂…', event: '活動', shareAvail: '分享空閒時間', availHint: '在日曆上拖曳以新增時段，或自動填入空閒時間。', fillFree: '填入空閒時間', copyText: '拷貝為文字', createHolds: '建立保留時段', clearAll: '清除', availCopied: '已拷貝空閒時間', availIntro: '以下是我方便的時間（{tz}）：', holdTitle: '保留', holdsCreated: '已建立 {n} 個保留時段', noSlots: '尚未選擇時段', exitAvail: '完成', customRepeat: '自訂重複', every: '每', uDay: '天', uWeek: '週', uMonth: '個月', uYear: '年', uDays: '天', uWeeks: '週', uMonths: '個月', uYears: '年', repeatOn: '重複於', ends: '結束', never: '永不', onDate: '於', after: '重複', occurrencesN: '次後', done: '完成', cancel: '取消', monthDayN: '每月 {n} 日', monthNth: '每月{o}個{d}', ordN: '第一|第二|第三|第四|最後一', ruleEvery: '每 {n} {u}', ruleOn: '的{d}', ruleCount: ',共 {n} 次', ruleUntil: ',直到 {d}',
  cut: '剪下', copy: '拷貝', paste: '貼上', duplicate: '複製', del: '刪除', deleteKey: '刪除', changeColor: '顏色',
  undo: '復原', deleted: '已刪除活動', moved: '已移動活動', created: '已建立活動', imported: '已匯入 {n} 個活動', updated: '已更新活動',
  thisEvent: '此活動', thisAndFollowing: '此活動及之後的活動', allEvents: '所有活動', editRecurring: '編輯重複活動', deleteRecurring: '刪除重複活動',
  noResults: '沒有結果', events: '活動', upcoming: '即將到來', past: '過去', mon: '星期一', sun: '星期日', sat: '星期六',
  rsvpGoing: '要參加嗎?', yes: '是', no: '否', maybe: '也許', organizer: '主辦人', more: '其他 {n} 個', week_n: '第{n}週',
  shortcutsGeneral: '一般', shortcutsViews: '檢視', shortcutsNav: '導覽', shortcutsEvents: '活動', shortcutsGrid: '網格',
  sCreate: '建立活動', sSearch: '搜尋', sSave: '儲存或確認', sEsc: '關閉或返回', sSelectAll: '選取所有可見項目',
  sDelete: '刪除', sDeleteNow: '立即刪除', sCut: '剪下', sCopy: '拷貝', sDuplicate: '複製', sPaste: '貼上', sUndo: '復原', sRedo: '重做',
  sDay: '天', sWeek: '週', sMonth: '月', sNDays: '2–9 天', sToday: '今天', sNext: '下一期間', sPrev: '上一期間',
  sZoomIn: '放大', sZoomOut: '縮小', sZoomReset: '重設縮放', sAllDay: '切換全天區', sTheme: '切換主題', sSettings: '設定',
  sShortcuts: '鍵盤快速鍵', sSidebar: '切換側邊欄', sPanel: '切換側面板', or: '或', drag: '拖曳',
  welcome: '歡迎使用 Tempo', quit: '結束 Tempo', nextEvent: '下一個:{t}', cardJoin: '加入', cardOpen: '開啟', cardDismiss: '關閉', startsNow: '即將開始', startsIn: '{n} 分鐘後', noUpcoming: '沒有即將到來的活動',
  newCalendar: '新日曆', rename: '重新命名', hideCal: '隱藏', showCal: '顯示', onlyThis: '只顯示此日曆', deleteCalendar: '刪除日曆',
  jumpTo: '跳至', enterDate: '輸入日期,例如 2026-11-03', durationMin: '{n}分鐘', durationH: '{n}小時', durationHM: '{h}小時{m}分鐘', declined: '已拒絕',
};
const zhCN: Dict = {
  ...zhTW,
  showWeekends: '显示周末', showDeclined: '显示已拒绝的活动', showWeekNumbers: '显示周数', week: '周', viewSettings: '视图设置',
  allDay: '全天', noTitle: '(无标题)', newEvent: '新活动', search: '搜索活动', searchShortcuts: '搜索快捷键',
  usefulShortcuts: '常用快捷键', commandMenu: '命令菜单', toggleSidebar: '切换侧边栏', goToDate: '前往日期',
  allShortcuts: '所有快捷键', calendars: '日历', addCalendar: '新建日历', importIcs: '导入 .ics…', exportIcs: '导出 .ics…',
  local: '在这台 Mac 上', defaultTag: '默认', typeCommand: '输入命令…', navigate: '导航', select: '选择', close: '关闭',
  secCalendar: '日历', secNavigation: '导航', secView: '视图', secPrefs: '偏好设置', secEvent: '活动',
  createEvent: '创建活动…', switchDay: '切换到日视图', switchWeek: '切换到周视图', switchMonth: '切换到月视图', switchNDays: '切换到 {n} 天视图',
  zoomIn: '放大时段', zoomOut: '缩小时段', zoomReset: '默认时段大小', toggleTheme: '切换浅色 / 深色主题',
  openSettings: '打开设置', toggleAllDay: '收起 / 展开全天区', deleteEvent: '删除活动', duplicateEvent: '复制活动',
  settings: '设置', general: '通用', profile: '个人资料', notifications: '通知', menuBar: '菜单栏', appearance: '外观',
  calendarView: '日历视图', weekStartsOn: '每周开始于', timeFormat: '时间格式', h12: '12 小时制', h24: '24 小时制',
  theme: '主题', themeSystem: '跟随系统', themeLight: '浅色', themeDark: '深色', language: '语言',
  timeZones: '时区', primaryTz: '主要时区', addTz: '添加时区', defaultDuration: '默认活动时长',
  reminders: '提醒事项', eventColor: '活动颜色', calendarColor: '日历颜色', addReminder: '添加提醒', participants: '参与者', addParticipants: '添加参与者', location: '地点', description: '描述',
  conferencing: '视频通话', addLink: '添加链接或附件', busy: '忙碌', free: '空闲', defaultVisibility: '默认可见性', publicV: '公开', privateV: '私密',
  repeat: '重复', timeZone: '时区', doesNotRepeat: '不重复', daily: '每天', weekly: '每周{d}', weekdays: '每个工作日(周一至周五)', customRepeat: '自定义重复', every: '每', uDay: '天', uWeek: '周', uMonth: '个月', uYear: '年', uDays: '天', uWeeks: '周', uMonths: '个月', uYears: '年', repeatOn: '重复于', ends: '结束', never: '永不', onDate: '于', after: '重复', occurrencesN: '次后', done: '完成', cancel: '取消', monthDayN: '每月 {n} 日', monthNth: '每月{o}个{d}', ordN: '第一|第二|第三|第四|最后一', ruleEvery: '每 {n} {u}', ruleOn: '的{d}', ruleCount: ',共 {n} 次', ruleUntil: ',直到 {d}', monthly: '每月 {n} 日', yearly: '每年 {d}', custom: '自定义…', shareAvail: '分享空闲时间', availHint: '在日历上拖动以添加时段，或自动填入空闲时间。', fillFree: '填入空闲时间', copyText: '拷贝为文字', createHolds: '创建保留时段', clearAll: '清除', availCopied: '已拷贝空闲时间', availIntro: '以下是我方便的时间（{tz}）：', holdTitle: '保留', holdsCreated: '已创建 {n} 个保留时段', noSlots: '尚未选择时段', exitAvail: '完成',
  cut: '剪切', copy: '拷贝', paste: '粘贴', duplicate: '复制', del: '删除', deleteKey: '删除', changeColor: '颜色',
  undo: '撤销', deleted: '已删除活动', moved: '已移动活动', created: '已创建活动', imported: '已导入 {n} 个活动', updated: '已更新活动',
  thisEvent: '此活动', thisAndFollowing: '此活动及后续活动', allEvents: '所有活动', editRecurring: '编辑重复活动', deleteRecurring: '删除重复活动',
  noResults: '没有结果', events: '活动', upcoming: '即将开始', past: '过去', week_n: '第{n}周', more: '其他 {n} 个',
  shortcutsViews: '视图', shortcutsNav: '导航', shortcutsGrid: '网格',
  sSave: '保存或确认', sSelectAll: '选择所有可见项', sCut: '剪切', sCopy: '拷贝', sDuplicate: '复制', sPaste: '粘贴', sUndo: '撤销', sRedo: '重做',
  sDay: '天', sWeek: '周', sNext: '下一时段', sPrev: '上一时段', sZoomReset: '重置缩放', sAllDay: '切换全天区', sSettings: '设置',
  sShortcuts: '键盘快捷键', sSidebar: '切换侧边栏', sPanel: '切换侧面板', drag: '拖动',
  welcome: '欢迎使用 Tempo', quit: '退出 Tempo', nextEvent: '下一个:{t}', cardJoin: '加入', cardOpen: '打开', cardDismiss: '关闭', startsNow: '即将开始', startsIn: '{n} 分钟后', noUpcoming: '没有即将开始的活动',
  newCalendar: '新日历', rename: '重命名', hideCal: '隐藏', showCal: '显示', onlyThis: '只显示此日历', deleteCalendar: '删除日历',
  jumpTo: '跳转到', enterDate: '输入日期,例如 2026-11-03', declined: '已拒绝',
};
export type Key = keyof typeof en;
const DICTS: Record<Locale, Dict> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN };
let cur: Locale = 'en';
export function setLocale(l: Locale) { cur = l; document.documentElement.lang = l; }
export function locale(): Locale { return cur; }
export function t(k: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[cur][k] ?? en[k];
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b));
  return s;
}
export function detectLocale(): Locale {
  const l = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
  if (l.startsWith('zh')) return /tw|hk|mo|hant/.test(l) ? 'zh-TW' : 'zh-CN';
  return 'en';
}
