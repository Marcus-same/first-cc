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
    const myCode = store.getMyCode();
    const sessions = store.getSessions(7);
    const streak = store.getStreak();
    const totalMin = Math.floor(sessions.reduce((a, s) => a + s.duration, 0) / 60);
    const d = `S${streak}W${sessions.length}M${totalMin}`;
    return {
      title: `我的肠道人格：${p ? p.icon : '🧬'} ${p ? p.name : '未知'}（BPTI ${this.data.code}）`,
      path: `/pages/personality/personality?invite=${myCode}&d=${d}`
    };
  },

  goTest() {
    wx.navigateTo({ url: '/pages/personality-test/personality-test' });
  }
});
