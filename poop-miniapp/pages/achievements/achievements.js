const { ALL, getUnlocked } = require('../../utils/achievements');
const store = require('../../utils/store');
const { getMilestone, celebrate } = require('../../utils/fun');
const app = getApp();

Page({
  data: { dark: false, achievements: [], totalSessions: 0, totalMin: 0, totalDays: 0, milestone: null },

  onShow() {
    this.setData({ dark: app.getDarkMode() });
    this.build();
  },

  build() {
    const allSessions = store.getAllSessions();
    const daysSet = {};
    allSessions.forEach(s => { daysSet[s._date || new Date(s.start).toDateString()] = true; });
    const allDays = Object.keys(daysSet);
    const friendCount = Object.keys(store.getFriends()).length;
    const unlocked = getUnlocked(allSessions, allDays, allSessions.length, friendCount);

    const achievements = ALL.map(a => ({
      ...a,
      unlocked: unlocked.includes(a.id),
      hint: a.unlocked ? '' : '完成一定条件后解锁'
    }));

    const totalSec = allSessions.reduce((s, x) => s + (x.duration || 0), 0);
    const milestone = getMilestone(allSessions.length);

    // Celebrate if first visit with achievements
    const prevUnlocked = wx.getStorageSync('_prev_achievements') || [];
    const newly = unlocked.filter(id => !prevUnlocked.includes(id));
    if (newly.length) {
      celebrate('achievement');
    }
    wx.setStorageSync('_prev_achievements', unlocked);

    this.setData({
      achievements,
      totalSessions: allSessions.length,
      totalMin: Math.floor(totalSec / 60),
      totalDays: store.getDayCount(),
      milestone
    });
  },

  goMap() { wx.navigateTo({ url: '/pages/map/map' }); },
  goSquad() { wx.navigateTo({ url: '/pages/squad/squad' }); }
});
