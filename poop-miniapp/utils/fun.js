const store = require('./store');

// --- Gut Personality (SBTI 12型 · MBTI灵感) ---
//
// 四维度框架:
//   时段 Time:  M(晨型) / E(晚型) / B(均衡)
//   速度 Speed: Q(快速) / L(悠闲) / M(适中)
//   类型 Type: S(稳定) / V(多变)
//   节律 Rhythm: R(规律) / C(随性)
// → 组合编码如 "M-Q-S-R", 映射到12种人格

const PERSONAS = [
  {
    id: 'golden', icon: '🍌', name: '黄金标准',
    sbti: 'M-Q-S-R',
    desc: '布里斯托4型是你的日常，柔软成型、排出顺畅。你的饮食和作息堪称教科书级别。',
    strength: '肠道状态是整体健康的最佳晴雨表',
    advice: '继续保持当前的饮食结构和作息习惯，你就是身边人的肠道健康榜样。',
    check(s) {
      const typed = s.filter(x => x.type);
      return typed.length >= 3 && typed.filter(x => x.type === 4).length / typed.length >= 0.5;
    }
  },
  {
    id: 'iron_gut', icon: '🛡️', name: '铁胃',
    sbti: 'B-M-S-R',
    desc: '不管是火锅烧烤还是麻辣烫，你的肠道都从容应对。几乎没有出现过便秘型（1-2型），肠道耐受性超强。',
    strength: '强大的肠道屏障功能，饮食自由度极高',
    advice: '你的肠道很强大，但别因此肆无忌惮。偶尔清淡饮食让肠道休息也是必要的。',
    check(s) {
      const typed = s.filter(x => x.type);
      if (typed.length < 3) return false;
      const bad = typed.filter(x => x.type === 1 || x.type === 2);
      const good = typed.filter(x => x.type === 4 || x.type === 5);
      return bad.length / typed.length < 0.1 && good.length / typed.length >= 0.5;
    }
  },
  {
    id: 'morning_elf', icon: '☀️', name: '晨间精灵',
    sbti: 'M-M-S-R',
    desc: '你的肠道像闹钟一样准时，清晨是它最活跃的时刻。规律的早餐后如厕习惯，说明你的生物钟和肠道菌群配合得天衣无缝。',
    strength: '规律是最好的肠道保养品',
    advice: '继续保持晨间排便习惯。如果某天早晨没有便意，喝杯温水再等10分钟，不要硬排。',
    check(s) {
      if (s.length < 3) return false;
      const morning = s.filter(x => { const h = new Date(x.start).getHours(); return h >= 5 && h < 10; });
      return morning.length / s.length >= 0.6;
    }
  },
  {
    id: 'night_owl', icon: '🦉', name: '夜猫子',
    sbti: 'E-L-C-C',
    desc: '夜深人静时你的肠道才开始活跃。虽然不是主流节奏，但只要规律就没问题。你的肠道有自己的时区。',
    strength: '夜间肠道蠕动效率更高，适合深度思考',
    advice: '注意睡前1小时完成排便，避免肛门充血影响睡眠。晚餐清淡、提前吃会更有帮助。',
    check(s) {
      if (s.length < 3) return false;
      const night = s.filter(x => { const h = new Date(x.start).getHours(); return h >= 21 || h < 3; });
      return night.length / s.length >= 0.4;
    }
  },
  {
    id: 'speed', icon: '⚡', name: '闪电侠',
    sbti: 'B-Q-S-C',
    desc: '来去如风！平均如厕时间不到3分钟，肠道效率极高。充分咀嚼、充足饮水和规律运动可能是你的秘诀。',
    strength: '高效率意味着肠道蠕动协调性极好',
    advice: '如果某次超过5分钟还没解决，起身走走等便意再来，别在厕所硬撑。',
    check(s) {
      if (s.length < 3) return false;
      const avg = s.reduce((a, x) => a + x.duration, 0) / s.length;
      return avg < 180;
    }
  },
  {
    id: 'thinker', icon: '🧘', name: '思考者',
    sbti: 'B-L-S-C',
    desc: '马桶是你的第二书房。虽然这是你的思考时间，但医学建议每次不超过10分钟。久坐增加痔疮风险。',
    strength: '你可能是排便时最放松的人',
    advice: '试着不带手机进厕所，专注排便可以缩短一半时间。如果习惯了带手机，用计时器提醒自己。',
    check(s) {
      if (s.length < 3) return false;
      const avg = s.reduce((a, x) => a + x.duration, 0) / s.length;
      return avg > 720;
    }
  },
  {
    id: 'explorer', icon: '🌍', name: '探险家',
    sbti: 'B-M-V-C',
    desc: '你在各种地方留下过"足迹"，真正的厕所地图绘制者。出差旅行也阻挡不了你的记录热情，适应力一流。',
    strength: '肠道适应性强，环境变化不敏感',
    advice: '旅行时随身带点益生菌和电解质泡腾片，可以帮助肠道更快适应新环境。',
    check(s) {
      const locs = new Set();
      s.forEach(x => { if (x.location && x.location.lat) locs.add(`${x.location.lat.toFixed(3)},${x.location.lng.toFixed(3)}`); });
      return locs.size >= 4;
    }
  },
  {
    id: 'rainbow', icon: '🎨', name: '多彩人生',
    sbti: 'B-M-V-C',
    desc: '你的肠道状态像彩虹一样丰富多彩，几乎集齐了所有Bristol类型。饮食丰富是你的特点，但肠道稳定性能更好一些。',
    strength: '饮食多样化的体现，营养素摄入全面',
    advice: '在保持饮食多样性的同时，试着固定三餐时间。肠道喜欢可预期的节奏。',
    check(s) {
      const types = new Set(s.filter(x => x.type).map(x => x.type));
      return types.size >= 4;
    }
  },
  {
    id: 'rhythm', icon: '🥁', name: '节奏大师',
    sbti: 'B-M-S-R',
    desc: '你的排便规律得像节拍器，几乎每天都在同一时段出现。这种规律性说明你的生活作息和肠道菌群极其稳定。',
    strength: '规律性是肠道健康最可靠的指标',
    advice: '你的肠道节奏已经成型，不要因为偶尔一天没排便就焦虑。休息日生物钟微调是正常的。',
    check(s) {
      if (s.length < 5) return false;
      const days = new Set(s.map(x => x._date || new Date(x.start).toDateString()));
      return days.size >= Math.min(s.length * 0.7, 20);
    }
  },
  {
    id: 'afternoon', icon: '🌤', name: '午后慵懒',
    sbti: 'B-M-B-R',
    desc: '你最喜欢在午后解决肠道问题。这说明你的胃结肠反射在午饭后最活跃，午餐质量不错！',
    strength: '与自然节律同步，符合人体生理规律',
    advice: '午餐保证有蔬菜和粗粮，可以为下午的顺利排便提供原料。午饭后散步10分钟效果更好。',
    check(s) {
      if (s.length < 3) return false;
      const peak = s.filter(x => { const h = new Date(x.start).getHours(); return h >= 12 && h < 16; });
      return peak.length / s.length >= 0.4;
    }
  },
  {
    id: 'focused', icon: '🎯', name: '专一型',
    sbti: 'B-M-S-C',
    desc: '你的肠道有明确的"偏好类型"，绝大部分记录集中在同一种Bristol类型上。这种专一说明你的饮食和消化模式非常固定。',
    strength: '肠道功能稳定，消化模式成熟',
    advice: '如果你的专属类型是4型或5型，恭喜你！如果是1-2型，需要增加水分和纤维；如果是6-7型，注意饮食卫生。',
    check(s) {
      const typed = s.filter(x => x.type);
      if (typed.length < 5) return false;
      const counts = {};
      typed.forEach(x => { counts[x.type] = (counts[x.type] || 0) + 1; });
      const max = Math.max(...Object.values(counts));
      return max / typed.length >= 0.7;
    }
  },
  {
    id: 'balanced', icon: '⚖️', name: '均衡型',
    sbti: 'B-M-B-C',
    desc: '你的肠道各项指标都在正常范围内，没有特别极端的倾向。这是一种低调但健康的平衡状态。',
    strength: '中庸之道最稳健，均衡本身就是最佳状态',
    advice: '没有什么需要大改的，继续保持均衡饮食和规律作息。偶尔关注一下肠道人格变化也挺有趣。',
    check() { return true; } // catch-all
  }
];

const DEFAULT_PERSONA = { id: 'newbie', icon: '🌱', name: '新生幼苗', sbti: '--', desc: '数据还不够多，继续记录几天就能看到你的肠道人格啦！', strength: '一切才刚刚开始', advice: '记录至少3次排便数据后，你的肠道人格就会显现。' };

/* 计算四维度分数和SBTI编码 */
function calcDims(sessions) {
  const dims = { time: 50, speed: 50, type: 50, rhythm: 50 };
  if (sessions.length < 2) return { dims, code: '--' };

  // 时段 Time: 0=晨型 100=夜型
  const hours = sessions.map(s => new Date(s.start).getHours());
  const morningPct = hours.filter(h => h >= 5 && h < 12).length / hours.length;
  const nightPct = hours.filter(h => h >= 20 || h < 3).length / hours.length;
  dims.time = Math.round(nightPct / (morningPct + nightPct || 1) * 100);
  const timeCode = morningPct >= 0.6 ? 'M' : nightPct >= 0.35 ? 'E' : 'B';

  // 速度 Speed: 0=快速 100=慢速
  const avgSec = sessions.reduce((a, s) => a + s.duration, 0) / sessions.length;
  dims.speed = Math.round(Math.min(avgSec / 15, 100));
  const speedCode = avgSec < 240 ? 'Q' : avgSec > 600 ? 'L' : 'M';

  // 类型 Type: 0=专一 100=多样
  const typed = sessions.filter(s => s.type);
  if (typed.length >= 3) {
    const types = new Set(typed.map(s => s.type));
    const counts = {};
    typed.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1; });
    dims.type = Math.round(Math.min((types.size - 1) / 5 * 100, 100));
  }
  const typeCode = dims.type < 30 ? 'S' : dims.type > 70 ? 'V' : 'B';

  // 节律 Rhythm: 0=规律 100=随性
  const days = new Set(sessions.map(s => s._date || new Date(s.start).toDateString()));
  const maxDays = Math.min(sessions.length, 14);
  const ratio = days.size / maxDays;
  dims.rhythm = Math.round((1 - Math.min(ratio, 1)) * 100);
  const rhythmCode = ratio >= 0.7 ? 'R' : 'C';

  const code = [timeCode, speedCode, typeCode, rhythmCode].join('-');
  return { dims, code };
}

function getPersonality() {
  const all = store.getAllSessions();
  if (all.length < 2) return { persona: DEFAULT_PERSONA, dims: { time: 50, speed: 50, type: 50, rhythm: 50 }, code: '--' };

  for (const p of PERSONAS) {
    if (p.check(all)) {
      const { dims, code } = calcDims(all);
      return { persona: { ...p, sbti: code }, dims, code };
    }
  }
  const { dims, code } = calcDims(all);
  return { persona: { ...DEFAULT_PERSONA, sbti: code }, dims, code };
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
  { id: 'healthy_duration', text: '如厕时间控制在 3～8 分钟', icon: '⏱️', check(sessions) {
    return sessions.some(s => s.duration >= 180 && s.duration <= 480 && new Date(s.start).toDateString() === new Date().toDateString());
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
  { id: 'two_types_today', text: '今天记录过两种以上不同类型', icon: '🎨', check(sessions) {
    const today = sessions.filter(s => new Date(s.start).toDateString() === new Date().toDateString());
    const types = new Set(today.filter(s => s.type).map(s => s.type));
    return types.size >= 2;
  }},
  { id: 'early_or_late', text: '在 7:00 前或 22:00 后记录', icon: '🦉', check(sessions) {
    return sessions.some(s => {
      const h = new Date(s.start).getHours();
      return (h < 7 || h >= 22) && new Date(s.start).toDateString() === new Date().toDateString();
    });
  }},
  { id: 'type_balanced', text: '今天记录的中间类型（3-5型）', icon: '🎯', check(sessions) {
    return sessions.some(s => s.type >= 3 && s.type <= 5 && new Date(s.start).toDateString() === new Date().toDateString());
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
