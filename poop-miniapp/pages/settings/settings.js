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
    wx.showModal({
      title: '备份已复制 ✅',
      content: '数据已复制到剪贴板。\n请粘贴保存到备忘录或发给「文件传输助手」。\n\n恢复时在「导入数据」中粘贴即可。',
      showCancel: false
    });
  },

  importData() {
    wx.getClipboardData({
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (!data.sessions && !data.friends && !data.myCode) {
            wx.showToast({ title: '剪贴板无有效备份数据', icon: 'none' });
            return;
          }
          wx.showModal({
            title: '确认导入',
            content: `发现备份数据：${data.sessions ? data.sessions.length + '条记录' : ''}${data.friends ? Object.keys(data.friends).length + '位好友' : ''}\n\n导入将覆盖当前所有数据，确认？`,
            success: (res) => {
              if (res.confirm) {
                // Rebuild days structure from flat sessions array
                const days = {};
                if (data.sessions) {
                  data.sessions.forEach(s => {
                    const key = s._date || new Date(s.start).toDateString();
                    if (!days[key]) days[key] = { sessions: [] };
                    const { _date, ...session } = s;
                    days[key].sessions.push(session);
                  });
                }
                wx.setStorageSync('poop_data', JSON.stringify({
                  days,
                  friends: data.friends || {},
                  myCode: data.myCode || '',
                  squadName: data.squadName || ''
                }));
                wx.showToast({ title: '数据已恢复！', icon: 'success' });
              }
            }
          });
        } catch (e) {
          wx.showToast({ title: '解析失败，非有效备份', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '读取剪贴板失败，请授权', icon: 'none' });
      }
    });
  },

  clearData() {
    wx.showModal({
      title: '确认清除',
      content: '将删除所有记录数据、好友数据和设置，不可恢复。确认？',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '二次确认',
            content: '真的要清除所有数据吗？此操作不可撤销！',
            success: (r2) => {
              if (r2.confirm) {
                store.clearAll();
                wx.showToast({ title: '已清除', icon: 'success' });
              }
            }
          });
        }
      }
    });
  },

  showHelp() {
    wx.showModal({
      title: '噗噗日记 使用帮助',
      content: '📝 打卡：开始计时 → 结束后选择便便类型 → 保存\n\n🗺️ 地图：记录时开启位置，自动生成噗噗地图\n\n👥 噗友：分享邀请码给好友，可PK比拼数据\n\n🧬 人格：BPTI肠道人格，12种类型等你发现\n\n💾 备份：设置页导出数据，可保存到备忘录',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  goAgreement() { wx.navigateTo({ url: '/pages/agreement/agreement' }); },
  goOnboarding() { wx.navigateTo({ url: '/pages/onboarding/onboarding' }); },
  goMap() { wx.switchTab({ url: '/pages/map/map' }); },
  goPersonality() { wx.navigateTo({ url: '/pages/personality/personality' }); },

  sendFeedback() {
    // Replaced by open-type="contact" button in WXML
  }
});
