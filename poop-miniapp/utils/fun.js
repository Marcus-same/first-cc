const store = require('./store');

// --- Gut Personality (unchanged) ---

const PERSONAS = [
  {
    id: 'morning', icon: '🌅', name: '晨型人',
    desc: '你的肠道像闹钟一样准时，清晨是它最活跃的时刻。规律的早餐后如厕习惯是健康肠道的标志。',
    check(sessions) {
      if (!sessions.length) return false;
      const morning = sessions.filter(s => {
        const h = new Date(s.start).getHours();
        return h >= 6 && h < 9;
      });
      return morning.length / sessions.length >= 0.8;
    }
  },
  {
    id: 'night_owl', icon: '🦉', name: '夜猫子',
    desc: '夜深人静时你的肠道才开始工作。虽然不是典型节奏，但只要规律就没问题。注意睡前别吃太重。',
    check(sessions) {
      if (!sessions.length) return false;
      const night = sessions.filter(s => {
        const h = new Date(s.start).getHours();
        return h >= 22;
      });
      return night.length / sessions.length >= 0.5;
    }
  },
  {
    id: 'speed', icon: '⚡', name: '闪电侠',
    desc: '来去如风！你的肠道效率极高，分分钟解决问题。充分咀嚼和足够水分可能是你的秘诀。',
    check(sessions) {
      if (!sessions.length) return false;
      const avg = sessions.reduce((a, s) => a + s.duration, 0) / sessions.length;
      return avg < 300;
    }
  },
  {
    id: 'thinker', icon: '🧘', name: '思考者',
    desc: '马桶是你的第二书房，你在上面思考人生。注意每次不要超过15分钟，避免久坐带来的隐患。',
    check(sessions) {
      if (!sessions.length) return false;
      const avg = sessions.reduce((a, s) => a + s.duration, 0) / sessions.length;
      return avg > 720;
    }
  },
  {
    id: 'golden', icon: '🍌', name: '黄金标准',
    desc: '布里斯托4型是你的日常，柔软成型、排出顺畅。你的饮食和作息堪称教科书级别。',
    check(sessions) {
      const typed = sessions.filter(s => s.type);
      if (!typed.length) return false;
      const type4 = typed.filter(s => s.type === 4);
      return type4.length / typed.length >= 0.6;
    }
  },
  {
    id: 'rainbow', icon: '🎨', name: '多彩人生',
    desc: '你的肠道状态变化丰富，各种类型都体验过。虽然有趣，但建议关注饮食规律性，让肠道更稳定。',
    check(sessions) {
      const types = new Set(sessions.filter(s => s.type).map(s => s.type));
      return types.size >= 5;
    }
  },
  {
    id: 'explorer', icon: '🌍', name: '探险家',
    desc: '你在各种地方留下过"足迹"，真正的厕所地图绘制者。出差旅行也阻挡不了你的记录热情。',
    check(sessions) {
      const locs = new Set();
      sessions.forEach(s => {
        if (s.location && s.location.lat) {
          locs.add(`${s.location.lat.toFixed(3)},${s.location.lng.toFixed(3)}`);
        }
      });
      return locs.size >= 5;
    }
  }
];

const DEFAULT_PERSONA = { id: 'newbie', icon: '🌱', name: '新生幼苗', desc: '数据还不够多，继续记录几天就能看到你的肠道人格啦！' };

function getPersonality() {
  const all = store.getAllSessions();
  for (const p of PERSONAS) {
    if (p.check(all)) return p;
  }
  return DEFAULT_PERSONA;
}

// --- Daily Fortune ---

const FORTUNES = {
  great: [
    '肠道节律稳定，今天适合尝试新食材！',
    '状态极佳，是时候挑战那家新开的火锅店了',
    '黄金标准在线！今天吃什么都不会翻车',
    '肠道菌群在为你鼓掌 👏 继续保持',
  ],
  good: [
    '节奏平稳，按部就班就好',
    '肠道在说：今天也请多关照 🙏',
    '状态不错，记得多喝水',
    '排便通畅，心情舒畅 ☀️',
  ],
  ok: [
    '今天多喝两杯水，肠道会感谢你的',
    '蔬菜水果安排上，给肠道加点油',
    '久坐伤肠道，记得起来走动走动',
    '少点外卖，你的肠道想换口味了',
  ],
  bad: [
    '今天可能有点艰难，多喝温水',
    '昨晚吃太重了？今天清淡饮食吧',
    '肠道在抗议，尝试少食多餐',
    '建议今天以温和食物为主，给肠道放个假',
  ]
};

function getFortune() {
  const all = store.getAllSessions();
  const streak = store.getStreak();
  const recent = all.slice(-7);
  let score = 3;

  if (streak >= 7) score += 1;
  else if (streak >= 3) score += 0.5;

  const typed = recent.filter(s => s.type);
  if (typed.length) {
    const avgType = typed.reduce((a, s) => a + s.type, 0) / typed.length;
    if (avgType >= 3.5 && avgType <= 4.5) score += 1;
    else if (avgType < 2 || avgType > 6) score -= 1;
  }

  const last7Days = new Set(recent.map(s => s._date));
  if (last7Days.size >= 6) score += 0.5;
  else if (last7Days.size < 2) score -= 0.5;

  let level;
  if (score >= 4) level = 'great';
  else if (score >= 3) level = 'good';
  else if (score >= 2) level = 'ok';
  else level = 'bad';

  const stars = score >= 4 ? '⭐⭐⭐⭐⭐' : score >= 3 ? '⭐⭐⭐⭐' : score >= 2 ? '⭐⭐⭐' : '⭐⭐';
  const msg = FORTUNES[level][Math.floor(Math.random() * FORTUNES[level].length)];

  const starsCount = score >= 4 ? 5 : score >= 3 ? 4 : score >= 2 ? 3 : 2;
  return { stars, level: starsCount, text: msg, streak, score };
}

// --- Milestones ---

function getMilestone(totalCount) {
  const milestones = [
    { at: 1, icon: '🎉', msg: '第一次记录！肠道健康之旅开始了' },
    { at: 10, icon: '🔟', msg: '十次达成！你是认真的' },
    { at: 50, icon: '🏆', msg: '五十次！肠道管理大师' },
    { at: 100, icon: '👑', msg: '百次里程碑！传奇成就解锁' },
  ];
  return milestones.reverse().find(m => totalCount >= m.at) || null;
}

// --- Celebration ---

function celebrate(type) {
  switch (type) {
    case 'achievement':
      wx.vibrateLong();
      wx.showToast({ title: '🏅 成就解锁！', icon: 'none', duration: 2000 });
      setTimeout(() => wx.vibrateShort(), 300);
      break;
    case 'milestone':
      wx.vibrateLong();
      break;
    case 'streak':
      wx.vibrateShort();
      wx.showToast({ title: '🔥 连续打卡！', icon: 'none', duration: 1500 });
      break;
    case 'challenge':
      wx.vibrateShort();
      wx.showToast({ title: '✅ 挑战完成！', icon: 'none', duration: 1500 });
      break;
  }
}

// ========== 🆕 Tier System ==========

const TIERS = [
  { id: 'seed', icon: '🌰', name: '种子肠道', min: 0, next: 5 },
  { id: 'bronze', icon: '🥉', name: '青铜肠道', min: 5, next: 20 },
  { id: 'silver', icon: '🥈', name: '白银肠道', min: 20, next: 50 },
  { id: 'gold', icon: '🥇', name: '黄金肠道', min: 50, next: 100 },
  { id: 'diamond', icon: '💎', name: '钻石肠道', min: 100, next: 200 },
  { id: 'master', icon: '🏆', name: '大师肠道', min: 200, next: 500 },
  { id: 'king', icon: '👑', name: '王者肠道', min: 500, next: -1 },
];

function getTier(totalCount) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (totalCount >= t.min) tier = t;
  }
  const nextTier = tier.next > 0 ? TIERS.find(t => t.min === tier.next) : null;
  const progress = nextTier ? Math.min(totalCount - tier.min, nextTier.min - tier.min) : 0;
  const progressTarget = nextTier ? nextTier.min - tier.min : 1;
  return {
    ...tier,
    totalCount,
    nextTier,
    progress,
    progressTarget,
    pct: nextTier ? Math.round(progress / progressTarget * 100) : 100
  };
}

// ========== 🆕 Daily Challenge ==========

const CHALLENGES = [
  { id: 'type4_today', text: '今天记录一次 4 型！', icon: '🍌', check(sessions) {
    return sessions.some(s => s.type === 4 && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'over_5min', text: '蹲坑超过 5 分钟', icon: '⏱️', check(sessions) {
    return sessions.some(s => s.duration > 300 && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'morning_poop', text: '在 9:00 前完成第一次记录', icon: '🌅', check(sessions) {
    return sessions.some(s => {
      const h = new Date(s.start).getHours();
      return h < 9 && new Date(s.start).toDateString() === new Date().toDateString();
    });
  }},
  { id: 'write_note', text: '写一条备注', icon: '📝', check(sessions) {
    return sessions.some(s => s.note && s.note.trim() && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'new_location', text: '记录一个新地点', icon: '📍', check(sessions) {
    const todaySessions = sessions.filter(s => new Date(s.start).toDateString() === new Date().toDateString());
    if (!todaySessions.length) return false;
    const allPast = sessions.filter(s => new Date(s.start).toDateString() !== new Date().toDateString());
    const pastLocs = new Set();
    allPast.forEach(s => {
      if (s.location && s.location.lat) pastLocs.add(`${s.location.lat.toFixed(3)},${s.location.lng.toFixed(3)}`);
    });
    return todaySessions.some(s => {
      if (!s.location || !s.location.lat) return false;
      return !pastLocs.has(`${s.location.lat.toFixed(3)},${s.location.lng.toFixed(3)}`);
    });
  }},
  { id: 'double_today', text: '今天记录 2 次以上', icon: '✌️', check(sessions) {
    const today = sessions.filter(s => new Date(s.start).toDateString() === new Date().toDateString());
    return today.length >= 2;
  }},
  { id: 'quick_one', text: '蹲坑少于 2 分钟', icon: '⚡', check(sessions) {
    return sessions.some(s => s.duration > 0 && s.duration < 120 && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'type1to3', text: '记录一次 1-3 型（偏干）', icon: '🪨', check(sessions) {
    return sessions.some(s => s.type >= 1 && s.type <= 3 && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'type5to7', text: '记录一次 5-7 型（偏稀）', icon: '💧', check(sessions) {
    return sessions.some(s => s.type >= 5 && s.type <= 7 && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'long_session', text: '蹲坑超过 10 分钟', icon: '🧘', check(sessions) {
    return sessions.some(s => s.duration > 600 && new Date(s.start).toDateString() === new Date().toDateString());
  }},
  { id: 'early_or_late', text: '在 7:00 前或 22:00 后记录', icon: '🦉', check(sessions) {
    return sessions.some(s => {
      const h = new Date(s.start).getHours();
      return (h < 7 || h >= 22) && new Date(s.start).toDateString() === new Date().toDateString();
    });
  }},
  { id: 'perfect_timing', text: '记录时间恰好是整点（±2分钟）', icon: '🎯', check(sessions) {
    return sessions.some(s => {
      const m = new Date(s.start).getMinutes();
      return (m <= 2 || m >= 58) && new Date(s.start).toDateString() === new Date().toDateString();
    });
  }},
];

function getDailyChallenge() {
  const today = new Date().toDateString();
  const data = JSON.parse(wx.getStorageSync('poop_data') || '{}');
  const saved = data._challenge;
  if (saved && saved.date === today) {
    return saved;
  }
  // Pick a new challenge for today
  const idx = Math.floor(Math.random() * CHALLENGES.length);
  const challenge = { date: today, id: CHALLENGES[idx].id, text: CHALLENGES[idx].text, icon: CHALLENGES[idx].icon, done: false };
  data._challenge = challenge;
  wx.setStorageSync('poop_data', JSON.stringify(data));
  return challenge;
}

function checkChallenge() {
  const today = new Date().toDateString();
  const data = JSON.parse(wx.getStorageSync('poop_data') || '{}');
  const saved = data._challenge;
  if (!saved || saved.date !== today || saved.done) return false;

  const sessions = store.getSessions(1); // today only
  const challengeDef = CHALLENGES.find(c => c.id === saved.id);
  if (challengeDef && challengeDef.check(sessions)) {
    saved.done = true;
    data._challenge = saved;
    wx.setStorageSync('poop_data', JSON.stringify(data));
    celebrate('challenge');
    return true;
  }
  return false;
}

module.exports = { PERSONAS, getPersonality, getFortune, getMilestone, celebrate, getTier, getDailyChallenge, checkChallenge, CHALLENGES };
