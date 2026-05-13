const { BRISTOL } = require('../../utils/health-tips');
const store = require('../../utils/store');
const app = getApp();

Page({
  data: { dark: false, heatmap: [], list: [], funFact: '', isEmpty: true },

  onShow() {
    this.setData({ dark: app.getDarkMode() });
    this.buildHeatmap();
    this.buildList();
  },

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
  }
});
