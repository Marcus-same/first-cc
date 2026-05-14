const { ALL, getAllWithProgress, getDistinctBristolTypes } = require('../../utils/achievements');
const store = require('../../utils/store');
const { celebrate, getTier } = require('../../utils/fun');
const { BRISTOL } = require('../../utils/health-tips');
const app = getApp();

Page({
  data: {
    dark: false, achievements: [], unlockedCount: 0,
    filteredAchievements: [],
    totalSessions: 0, totalMin: 0, totalDays: 0,
    tier: null,
    museum: [], museumCollected: 0,
    catIdx: 0
  },

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
    const totalCount = allSessions.length;

    const achievementsWithProgress = getAllWithProgress(allSessions, allDays, totalCount, friendCount);
    const unlockedCount = achievementsWithProgress.filter(a => a.unlocked).length;

    const totalSec = allSessions.reduce((s, x) => s + (x.duration || 0), 0);
    const tier = getTier(totalCount);

    // Museum: collected Bristol types
    const collectedTypes = getDistinctBristolTypes(allSessions);
    const museum = BRISTOL.map(b => ({
      ...b,
      collected: allSessions.some(s => s.type === b.type)
    }));

    // Celebrate new achievements
    const unlocked = achievementsWithProgress.filter(a => a.unlocked).map(a => a.id);
    const prevUnlocked = wx.getStorageSync('_prev_achievements') || [];
    const newly = unlocked.filter(id => !prevUnlocked.includes(id));
    if (newly.length) {
      celebrate('achievement');
    }
    wx.setStorageSync('_prev_achievements', unlocked);

    this.setData({
      achievements: achievementsWithProgress,
      filteredAchievements: this.filterByCategory(achievementsWithProgress, this.data.catIdx),
      unlockedCount,
      totalSessions: totalCount,
      totalMin: Math.floor(totalSec / 60),
      totalDays: store.getDayCount(),
      tier,
      museum,
      museumCollected: museum.filter(m => m.collected).length
    });
  },

  filterByCategory(achievements, catIdx) {
    const catMap = { 0: null, 1: 'milestone', 2: 'streak', 3: 'collection' };
    const cat = catMap[catIdx];
    if (!cat) return achievements;
    return achievements.filter(a => a.category === cat);
  },

  onCatTap(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({
      catIdx: idx,
      filteredAchievements: this.filterByCategory(this.data.achievements, idx)
    });
  },

});
