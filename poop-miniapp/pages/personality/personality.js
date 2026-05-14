const { getPersonality } = require('../../utils/fun');
const store = require('../../utils/store');
const app = getApp();

Page({
  data: { dark: false, persona: null, dims: null, code: '', totalSessions: 0 },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
    const result = getPersonality();
    const totalSessions = store.getAllSessions().length;
    this.setData({ persona: result.persona, dims: result.dims, code: result.code, totalSessions });
  },

  onShareAppMessage() {
    const p = this.data.persona;
    return {
      title: `我的肠道人格：${p.icon} ${p.name}（BPTI ${this.data.code}）`,
      path: '/pages/index/index'
    };
  },

  goTest() {
    wx.navigateTo({ url: '/pages/personality-test/personality-test' });
  }
});
