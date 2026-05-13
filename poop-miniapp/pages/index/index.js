const { TIPS } = require('../../utils/health-tips');
const store = require('../../utils/store');
const { getFortune, getMilestone, celebrate } = require('../../utils/fun');
const app = getApp();

Page({
  data: {
    dark: false, timeStr: '00:00', running: false, elapsed: 0,
    runTip: '', warnSec: 600, warnMin: 10, warned: false, warnEnabled: true,
    statItems: [
      { key: 'count', val: 0, label: '今日次数' },
      { key: 'totalMin', val: 0, label: '总时长(分)' },
      { key: 'best', val: '--', label: '最短' },
      { key: 'avg', val: '--', label: '平均' },
    ],
    streak: 0, dailyTip: '', fortune: null, isEmpty: true
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
    this.setData({ dailyTip: TIPS[Math.floor(Math.random() * TIPS.length)] });

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
    if (!s.length) {
      this.setData({
        isEmpty: true,
        statItems: [
          { key: 'count', val: 0, label: '今日次数' },
          { key: 'totalMin', val: 0, label: '总时长(分)' },
          { key: 'best', val: '--', label: '最短' },
          { key: 'avg', val: '--', label: '平均' },
        ]
      });
      return;
    }
    this.setData({ isEmpty: false });
    const totalSec = s.reduce((a, b) => a + b.duration, 0);
    const times = s.map(x => Math.floor(x.duration / 60));
    this.setData({
      statItems: [
        { key: 'count', val: s.length, label: '今日次数' },
        { key: 'totalMin', val: Math.floor(totalSec / 60), label: '总时长(分)' },
        { key: 'best', val: Math.min(...times) + '分', label: '最短' },
        { key: 'avg', val: Math.round(totalSec / s.length / 60) + '分', label: '平均' },
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

  goHistory() { wx.switchTab({ url: '/pages/history/history' }); },
  goWeekly() { wx.navigateTo({ url: '/pages/weekly/weekly' }); },
  goAchievements() { wx.switchTab({ url: '/pages/achievements/achievements' }); },
  goPersonality() { wx.navigateTo({ url: '/pages/personality/personality' }); }
});
