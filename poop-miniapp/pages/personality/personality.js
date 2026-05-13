const { getPersonality } = require('../../utils/fun');
const store = require('../../utils/store');
const app = getApp();

Page({
  data: { dark: false, persona: null, totalSessions: 0 },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
    const persona = getPersonality();
    const totalSessions = store.getAllSessions().length;
    this.setData({ persona, totalSessions });
  },

  onShareAppMessage() {
    const p = this.data.persona;
    return {
      title: `我的肠道人格：${p.icon} ${p.name}`,
      path: '/pages/index/index'
    };
  }
});
