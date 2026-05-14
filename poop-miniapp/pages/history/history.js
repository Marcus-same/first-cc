const { BRISTOL } = require('../../utils/health-tips');
const store = require('../../utils/store');
const app = getApp();

Page({
  data: {
    dark: false,
    heatmap: [], list: [], funFact: '', isEmpty: true,
    totalSessions: 0, totalMin: 0, totalDays: 0,
    tabView: 'record',
    weekly: {},
    weekOptions: [],
    selectedWeekIdx: 0
  },

  onShow() {
    this.setData({ dark: app.getDarkMode() });

    // Check for pending view switch (e.g., from index "本周报告")
    if (app.globalData.pendingView === 'weekly') {
      app.globalData.pendingView = null;
      this.setData({ tabView: 'weekly' });
    }

    this.buildHeatmap();
    this.buildList();
    this.buildStats();
    if (this.data.tabView === 'weekly') {
      this.buildWeekOptions();
      this.buildWeeklyReport();
    }
  },

  // ======== Tab 切换 ========
  onTabTap(e) {
    const view = e.currentTarget.dataset.view;
    this.setData({ tabView: view });
    if (view === 'weekly') {
      this.buildWeekOptions();
      this.buildWeeklyReport();
    }
  },

  // ======== 热力图 ========
  buildHeatmap() {
    const weeks = [];
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
    const allSessions = store.getSessions(28);
    const countMap = {};
    allSessions.forEach(s => {
      const d = new Date(s.start).toDateString();
      countMap[d] = (countMap[d] || 0) + 1;
    });

    for (let w = 3; w >= 0; w--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - w * 7);
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + d);
        const key = date.toDateString();
        const cnt = countMap[key] || 0;
        days.push({ date: key, level: cnt >= 3 ? 'l3' : cnt === 2 ? 'l2' : cnt === 1 ? 'l1' : 'l0', count: cnt });
      }
      weeks.push({ label: w === 3 ? DAYS.join(' ') : '', days });
    }
    this.setData({ heatmap: weeks });
  },

  // ======== 记录列表 ========
  buildList() {
    const sessions = store.getSessions(60).sort((a, b) => b.start - a.start).slice(0, 50);
    this.setData({ isEmpty: sessions.length === 0 });

    let totalSec = sessions.reduce((s, x) => s + (x.duration || 0), 0);
    const totalMin = Math.floor(totalSec / 60);
    const movieCount = Math.floor(totalMin / 120);
    const songCount = Math.floor(totalMin / 4);
    let funFact = '';
    if (totalMin > 0) {
      funFact = movieCount > 0
        ? `累计蹲坑 ${totalMin} 分钟，相当于看完 ${movieCount} 部电影，或听完 ${songCount} 首歌 🎵`
        : `累计蹲坑 ${totalMin} 分钟，相当于听完 ${songCount} 首歌 🎵`;
    } else {
      funFact = '还没有记录，开始你的肠道健康之旅吧！';
    }
    this.setData({ funFact });

    const list = sessions.map(s => {
      const d = new Date(s.start);
      const typeInfo = BRISTOL.find(b => b.type === s.type);
      return {
        dateStr: `${d.getMonth() + 1}月${d.getDate()}日`,
        timeStr: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        min: Math.floor(s.duration / 60),
        sec: s.duration % 60,
        typeIcon: typeInfo ? typeInfo.icon : '❓',
        typeName: typeInfo ? typeInfo.name : '未记录',
        note: s.note || ''
      };
    });
    this.setData({ list });
  },

  // ======== 累计统计 ========
  buildStats() {
    const all = store.getAllSessions();
    const totalSec = all.reduce((s, x) => s + (x.duration || 0), 0);
    this.setData({
      totalSessions: all.length,
      totalMin: Math.floor(totalSec / 60),
      totalDays: store.getDayCount()
    });
  },

  // ======== 周选择器 ========
  buildWeekOptions() {
    const options = [];
    for (let i = 0; i < 52; i++) {
      const monday = this.getMondayOffset(-i * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const label = `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`;
      options.push({ label, monday: monday.getTime() });
    }
    this.setData({ weekOptions: options, selectedWeekIdx: 0 });
  },

  onWeekChange(e) {
    const idx = e.detail.value;
    this.setData({ selectedWeekIdx: idx });
    const monday = new Date(this.data.weekOptions[idx].monday);
    this.buildWeeklyReport(monday);
  },

  getMondayOffset(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dayOfWeek = d.getDay() || 7;
    d.setDate(d.getDate() - dayOfWeek + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // ======== 周报 ========
  buildWeeklyReport(monday) {
    if (!monday) {
      const today = new Date();
      const dayOfWeek = today.getDay() || 7;
      monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek + 1);
      monday.setHours(0, 0, 0, 0);
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dateRange = `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
    const DAYS = ['一', '二', '三', '四', '五', '六', '日'];

    const allSessions = [];
    const bars = [];
    let activeDays = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = d.toDateString();
      const sessions = store.getSessions(30).filter(s => s._date === key);
      allSessions.push(...sessions);
      if (sessions.length > 0) activeDays++;
      const maxH = 160;
      const cnt = sessions.length;
      bars.push({ day: DAYS[i], count: cnt, height: Math.min(cnt * 35, maxH) });
    }

    const total = allSessions.length;
    const totalSec = allSessions.reduce((s, x) => s + (x.duration || 0), 0);

    if (total === 0) {
      this.setData({ weekly: {} });
      return;
    }

    // Type distribution
    const typeCount = {};
    allSessions.forEach(s => {
      if (s.type) typeCount[s.type] = (typeCount[s.type] || 0) + 1;
    });
    const TYPE_COLORS = { 1: '#8b6914', 2: '#a08050', 3: '#c9a05a', 4: '#6b8e4e', 5: '#8cba6a', 6: '#d4956a', 7: '#e07b5a' };
    const typeDist = Object.entries(typeCount).map(([type, cnt]) => {
      const b = BRISTOL.find(x => x.type === parseInt(type));
      return { icon: b ? b.icon : '❓', pct: Math.round(cnt / total * 100), color: TYPE_COLORS[type] || '#999' };
    }).sort((a, b) => b.pct - a.pct);

    // Advice
    let advice = '';
    if (activeDays < 3) {
      advice = '本周排便天数偏少，建议保持规律作息，每天早餐后尝试如厕，培养规律。';
    } else if (activeDays >= 6) {
      advice = '排便非常规律！保持当前饮食习惯和作息。肠道健康是整体健康的基础 👏';
    } else {
      advice = '排便规律性良好。建议注意膳食纤维摄入，每天保证充足饮水。';
    }
    const typesWithData = Object.keys(typeCount);
    if (typesWithData.includes('1') || typesWithData.includes('2')) {
      advice += ' 本周有便秘倾向，建议增加饮水量和膳食纤维。';
    }
    if (typesWithData.includes('6') || typesWithData.includes('7')) {
      advice += ' 本周有腹泻情况，注意饮食卫生和清淡饮食。';
    }

    const alerts = this.checkAlerts(allSessions, bars);

    this.setData({
      weekly: {
        dateRange,
        summary: {
          total,
          days: activeDays,
          avgPerDay: activeDays ? (total / activeDays).toFixed(1) : 0,
          avgMin: totalSec ? Math.round(totalSec / total / 60) : 0
        },
        bars, typeDist, advice, alerts
      }
    });
  },

  checkAlerts(sessions, bars) {
    const alerts = [];

    // Consecutive 0 days > 3
    const zeroStreak = this.maxConsecutiveZeros(bars);
    if (zeroStreak > 3) {
      alerts.push({ icon: '⚠️', level: 'warn', text: `连续 ${zeroStreak} 天无排便记录，建议咨询医生排查便秘原因` });
    }

    // Consecutive type 7 > 2
    const allSessions30 = store.getSessions(30);
    const recentByDay = {};
    allSessions30.forEach(s => {
      const d = s._date || new Date(s.start).toDateString();
      if (!recentByDay[d]) recentByDay[d] = [];
      recentByDay[d].push(s);
    });
    const sortedDays = Object.keys(recentByDay).sort().reverse();
    let type7Streak = 0;
    for (const day of sortedDays) {
      const all = recentByDay[day];
      if (all.length && all.every(s => s.type === 7)) type7Streak++;
      else break;
    }
    if (type7Streak > 2) {
      alerts.push({ icon: '🚨', level: 'danger', text: `连续 ${type7Streak} 天全部为腹泻型(7型)，可能脱水，建议尽快就医` });
    }

    // Type span > 5 in a week
    const types = new Set(sessions.filter(s => s.type).map(s => s.type));
    if (types.size > 5) {
      alerts.push({ icon: '📊', level: 'warn', text: '本周肠道状态波动较大(5种以上类型)，建议关注饮食规律' });
    }

    // Single session > 30 min
    const long = sessions.filter(s => s.duration > 1800);
    if (long.length) {
      alerts.push({ icon: '⏰', level: 'info', text: `${long.length} 次如厕超过30分钟，久坐增加痔疮风险，建议控制时间` });
    }

    return alerts;
  },

  maxConsecutiveZeros(bars) {
    let max = 0, cur = 0;
    for (const b of bars) {
      if (b.count === 0) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    }
    return max;
  }
});
