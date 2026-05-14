const { BRISTOL } = require('../../utils/health-tips');
const store = require('../../utils/store');
const app = getApp();

Page({
  data: {
    dark: false, dateRange: '', summary: {}, bars: [], typeDist: [], advice: '', alerts: []
  },

  onLoad() {
    this.setData({ dark: app.getDarkMode() });
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    this.setData({
      dateRange: `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`
    });
    this.buildReport(monday);
  },

  buildReport(monday) {
    const allSessions = [];
    const bars = [];
    const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
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

    // Medical alerts
    const alerts = this.checkAlerts(allSessions, bars);

    this.setData({
      summary: {
        total,
        days: activeDays,
        avgPerDay: activeDays ? (total / activeDays).toFixed(1) : 0,
        avgMin: totalSec ? Math.round(totalSec / total / 60) : 0
      },
      bars, typeDist, advice, alerts
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
  },

  onShareAppMessage() {
    const s = this.data.summary;
    return {
      title: `肠道周报 | ${s.total}次记录 · ${s.days}天活跃`,
      path: '/pages/index/index',
      imageUrl: '' // Could use canvas snapshot here
    };
  },

  saveImage() {
    wx.showToast({ title: '长按屏幕截图保存', icon: 'none', duration: 2000 });
  }
});
