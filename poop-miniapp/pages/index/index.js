const { generateTip } = require('../../utils/health-tips');
const store = require('../../utils/store');
const { getFortune, getMilestone, celebrate, getDailyChallenge } = require('../../utils/fun');
const app = getApp();

Page({
  data: {
    dark: false, timeStr: '00:00', running: false, elapsed: 0,
    runTip: '', warnSec: 600, warnMin: 10, warned: false, warnEnabled: true,
    statItems: [
      { key: 'count', val: 0, label: '今日次数', icon: '🧻' },
      { key: 'totalMin', val: 0, label: '总时长(分)', icon: '⏱️' },
      { key: 'best', val: '--', label: '最短', icon: '⚡' },
      { key: 'avg', val: '--', label: '平均', icon: '📊' },
    ],
    streak: 0, dailyTip: '', fortune: null, challenge: null, isEmpty: true
  },
  timerId: null, startTime: 0,

  onShow() {
    this.setData({ dark: app.getDarkMode() });
    const s = wx.getStorageSync('app_settings') || {};
    const warnSec = (s.warnMin || 10) * 60;
    this.setData({ warnSec, warnEnabled: s.warnEnabled !== false });
    this.loadStats();
    this.loadStreak();
    this.loadFortune();
    this.loadChallenge();
    const todaySessions = store.getToday().sessions;
    this.setData({ dailyTip: generateTip(todaySessions, store.getStreak()) });

    // Timer recovery: check if there's an unfinished timer from last session
    const ts = wx.getStorageSync('_timer_state');
    if (ts && ts.running) {
      const elapsed = Math.floor((Date.now() - ts.startTime) / 1000);
      this.startTime = ts.startTime;
      this.setData({ running: true, runTip: '正在记录中…', warned: false, elapsed });
      this.resumeTimer();
    }
  },

  onHide() {
    // Save timer state before hiding to restore later
    if (this.data.running) {
      wx.setStorageSync('_timer_state', { startTime: this.startTime, running: true });
    }
    if (this.timerId) clearInterval(this.timerId);
  },

  resumeTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      this.setData({ timeStr: m + ':' + s, elapsed, warnMin: Math.floor(elapsed / 60) });
      if (elapsed >= this.data.warnSec && !this.data.warned) {
        this.setData({ warned: true });
        if (this.data.warnEnabled) wx.vibrateLong();
      }
    }, 200);
  },

  loadStats() {
    const today = store.getToday();
    const s = today.sessions;
    // 用永久标记判断，数据清除后也不会重新出现新手引导
    const hasHistory = !!wx.getStorageSync('_has_ever_recorded');
    if (!s.length) {
      this.setData({
        isEmpty: true,
        hasHistory,  // 有过记录 → 不显示"准备好开始记录了么"
        statItems: [
          { key: 'count', val: 0, label: '今日次数', icon: '🧻' },
          { key: 'totalMin', val: 0, label: '总时长(分)', icon: '⏱️' },
          { key: 'best', val: '--', label: '最短', icon: '⚡' },
          { key: 'avg', val: '--', label: '平均', icon: '📊' },
        ]
      });
      return;
    }
    this.setData({ isEmpty: false });
    const totalSec = s.reduce((a, b) => a + b.duration, 0);
    const times = s.map(x => Math.floor(x.duration / 60));
    this.setData({
      statItems: [
        { key: 'count', val: s.length, label: '今日次数', icon: '🧻' },
        { key: 'totalMin', val: Math.floor(totalSec / 60), label: '总时长(分)', icon: '⏱️' },
        { key: 'best', val: Math.min(...times) + '分', label: '最短', icon: '⚡' },
        { key: 'avg', val: Math.round(totalSec / s.length / 60) + '分', label: '平均', icon: '📊' },
      ]
    });
  },

  loadStreak() {
    const streak = store.getStreak();
    this.setData({ streak });
    // Celebrate streaks
    if (streak === 7) celebrate('streak');
  },

  loadFortune() {
    this.setData({ fortune: getFortune() });
  },

  loadChallenge() {
    this.setData({ challenge: getDailyChallenge() });
  },

  onStart() {
    this.startTime = Date.now();
    this.setData({ running: true, runTip: '正在记录中…', warned: false });
    wx.setStorageSync('_timer_state', { startTime: this.startTime, running: true });
    // Vibration feedback
    wx.vibrateShort();
    this.resumeTimer();
  },

  onStop() {
    clearInterval(this.timerId);
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    wx.setStorageSync('_last_session', { time: Date.now(), duration: elapsed });
    wx.removeStorageSync('_timer_state');
    wx.vibrateShort();
    this.setData({ running: false, timeStr: '00:00', elapsed: 0, runTip: '' });
    wx.navigateTo({ url: '/pages/record/record' });
  },

  goWeekly() {
    app.globalData.pendingView = 'weekly';
    wx.navigateTo({ url: '/pages/history/history' });
  },
  goAchievements() { wx.navigateTo({ url: '/pages/achievements/achievements' }); },
  goPersonality() { wx.navigateTo({ url: '/pages/personality/personality' }); },

  onShareAppMessage() {
    const myCode = store.getMyCode();
    return {
      title: '噗噗日记 — 记录肠道健康，和朋友一起打卡！',
      path: `/pages/index/index?invite=${myCode}`,
      imageUrl: '' // 可替换为分享卡片图
    };
  }
});
