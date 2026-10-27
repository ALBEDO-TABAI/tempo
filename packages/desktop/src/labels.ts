/** Native menu / tray strings (Tempo's own wording). */
export type Lang = 'en' | 'zh-TW' | 'zh-CN';
const EN = {
  about: 'About Tempo', settings: 'Settings…', services: 'Services', hide: 'Hide Tempo', hideOthers: 'Hide Others', showAll: 'Show All', quit: 'Quit Tempo',
  file: 'File', newEvent: 'New Event', importIcs: 'Import .ics…', exportIcs: 'Export .ics…', closeWindow: 'Close Window',
  edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', pasteMatch: 'Paste and Match Style', del: 'Delete', selectAll: 'Select All Visible', duplicate: 'Duplicate', speech: 'Speech',
  view: 'View', zoomReset: 'Default Hour Size', zoomIn: 'Zoom Hours In', zoomOut: 'Zoom Hours Out', scale: 'Interface Scale', actual: 'Actual Size', scaleIn: 'Zoom In', scaleOut: 'Zoom Out', reload: 'Reload', forceReload: 'Force Reload', devtools: 'Toggle Developer Tools', fullscreen: 'Toggle Full Screen',
  dayView: 'Day', weekView: 'Week', monthView: 'Month', today: 'Today', commandMenu: 'Command Menu…',
  window: 'Window', minimize: 'Minimize', zoom: 'Zoom', front: 'Bring All to Front', main: 'Tempo',
  help: 'Help', shortcuts: 'Keyboard Shortcuts', debug: 'Debug', reset: 'Reset App Data…', resetQ: 'Erase all local calendars and events?', resetD: 'This cannot be undone.', cancel: 'Cancel',
  open: 'Open Tempo', none: 'No upcoming events',
};
const TW: typeof EN = {
  about: '關於 Tempo', settings: '設定…', services: '服務', hide: '隱藏 Tempo', hideOthers: '隱藏其他', showAll: '顯示全部', quit: '結束 Tempo',
  file: '檔案', newEvent: '新增活動', importIcs: '匯入 .ics…', exportIcs: '匯出 .ics…', closeWindow: '關閉視窗',
  edit: '編輯', undo: '還原', redo: '重做', cut: '剪下', copy: '拷貝', paste: '貼上', pasteMatch: '貼上並符合樣式', del: '刪除', selectAll: '全選可見活動', duplicate: '複製活動', speech: '語音',
  view: '顯示方式', zoomReset: '預設小時高度', zoomIn: '放大小時', zoomOut: '縮小小時', scale: '介面縮放', actual: '實際大小', scaleIn: '放大', scaleOut: '縮小', reload: '重新載入', forceReload: '強制重新載入', devtools: '開發者工具', fullscreen: '切換全螢幕',
  dayView: '日', weekView: '週', monthView: '月', today: '今天', commandMenu: '指令選單…',
  window: '視窗', minimize: '縮到最小', zoom: '縮放', front: '將此程式所有視窗移至最前', main: 'Tempo',
  help: '輔助說明', shortcuts: '鍵盤快速鍵', debug: '除錯', reset: '重設 App 資料…', resetQ: '要清除所有本機日曆和活動嗎？', resetD: '此操作無法復原。', cancel: '取消',
  open: '開啟 Tempo', none: '沒有即將開始的活動',
};
const CN: typeof EN = {
  ...TW, about: '关于 Tempo', settings: '设置…', services: '服务', hide: '隐藏 Tempo', hideOthers: '隐藏其他', showAll: '全部显示', quit: '退出 Tempo',
  file: '文件', newEvent: '新建活动', importIcs: '导入 .ics…', exportIcs: '导出 .ics…', closeWindow: '关闭窗口',
  edit: '编辑', undo: '撤销', redo: '重做', cut: '剪切', copy: '拷贝', paste: '粘贴', pasteMatch: '粘贴并匹配样式', del: '删除', selectAll: '全选可见活动', duplicate: '复制活动', speech: '语音',
  view: '显示', zoomReset: '默认小时高度', zoomIn: '放大小时', zoomOut: '缩小小时', scale: '界面缩放', actual: '实际大小', scaleIn: '放大', scaleOut: '缩小', reload: '重新加载', forceReload: '强制重新加载', devtools: '开发者工具', fullscreen: '切换全屏',
  dayView: '日', weekView: '周', monthView: '月', today: '今天', commandMenu: '命令菜单…',
  window: '窗口', minimize: '最小化', zoom: '缩放', front: '前置全部窗口',
  help: '帮助', shortcuts: '键盘快捷键', debug: '调试', reset: '重置 App 数据…', resetQ: '要清除所有本地日历和活动吗？', resetD: '此操作无法撤销。', cancel: '取消',
  open: '打开 Tempo', none: '没有即将开始的活动',
};
export type Labels = typeof EN;
export function labels(lang: string): Labels { return lang === 'zh-TW' || /^zh-(Hant|TW|HK|MO)/i.test(lang) ? TW : /^zh/i.test(lang) ? CN : EN; }
