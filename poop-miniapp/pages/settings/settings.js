const app = getApp();
const store = require('../../utils/store');

Page({
  data: {
    dark: false, warnEnabled: true, warnMin: 10,
    themeOptions: ['跟随系统', '浅色', '深色'], themeIdx: 0
  },

  onShow() {
    this.setData({ dark: app.getDarkMode() });
    const s = wx.getStorageSync('app_settings') || {};
    this.setData({
      warnEnabled: s.warnEnabled !== false,
      warnMin: s.warnMin || 10,
      themeIdx: s.darkMode === 'dark' ? 2 : s.darkMode === 'light' ? 1 : 0
    });
  },

  toggleWarn(e) {
    this.setData({ warnEnabled: e.detail.value });
    this.saveSettings({ warnEnabled: e.detail.value });
  },

  showWarnPicker() {
    const mins = [5, 8, 10, 12, 15, 20];
    const names = mins.map(m => m + '分钟');
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const m = mins[res.tapIndex];
        this.setData({ warnMin: m });
        this.saveSettings({ warnMin: m });
      }
    });
  },

  changeTheme(e) {
    const modes = ['auto', 'light', 'dark'];
    const mode = modes[e.detail.value];
    this.setData({ themeIdx: e.detail.value });
    app.setDarkMode(mode);
    this.setData({ dark: app.getDarkMode() });
    this.saveSettings({ darkMode: mode });
  },

  saveSettings(partial) {
    const s = wx.getStorageSync('app_settings') || {};
    Object.assign(s, partial);
    wx.setStorageSync('app_settings', s);
  },

  exportData() {
    const data = store.exportAll();
    wx.setClipboardData({ data: JSON.stringify(data, null, 2) });
    wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
  },

  clearData() {
    wx.showModal({
      title: '确认清除',
      content: '将删除所有记录数据、好友数据和设置，不可恢复。确认？',
      success: (res) => {
        if (res.confirm) {
          store.clearAll();
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },

  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  goAgreement() { wx.navigateTo({ url: '/pages/agreement/agreement' }); },
  goOnboarding() { wx.navigateTo({ url: '/pages/onboarding/onboarding' }); },
  goSquad() { wx.navigateTo({ url: '/pages/squad/squad' }); },
  goMap() { wx.navigateTo({ url: '/pages/map/map' }); },
  goPersonality() { wx.navigateTo({ url: '/pages/personality/personality' }); },

  sendFeedback() {
    wx.showModal({
      title: '反馈建议',
      content: '请将建议发送至开发者飞书群「Claude Code Bridge」',
      showCancel: false
    });
  }
});
