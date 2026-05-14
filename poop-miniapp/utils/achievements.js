// --- Helpers ---

function checkStreak(allDays, n) {
  if (allDays.length < n) return false;
  const sorted = [...new Set(allDays)].sort().reverse();
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = new Date(sorted[i]);
    const d2 = new Date(sorted[i + 1]);
    if ((d1 - d2) / 86400000 <= 1.5) streak++;
    else break;
  }
  return streak >= n;
}

function getStreakLength(allDays) {
  const sorted = [...new Set(allDays)].sort().reverse();
  if (!sorted.length) return 0;
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = new Date(sorted[i]);
    const d2 = new Date(sorted[i + 1]);
    if ((d1 - d2) / 86400000 <= 1.5) streak++;
    else break;
  }
  return streak;
}

function countDistinctLocations(sessions) {
  const locs = new Set();
  sessions.forEach(s => {
    if (s.location && s.location.lat) {
      locs.add(`${s.location.lat.toFixed(3)},${s.location.lng.toFixed(3)}`);
    }
  });
  return locs.size;
}

function countDistinctCities(sessions) {
  const cities = new Set();
  sessions.forEach(s => {
    if (s.location && s.location.name) {
      cities.add(s.location.name);
    }
  });
  return cities.size;
}

function hasPrecisionTime(sessions) {
  const hourMap = {};
  sessions.forEach(s => {
    const d = new Date(s.start);
    const h = d.getHours();
    if (!hourMap[h]) hourMap[h] = new Set();
    hourMap[h].add(new Date(s.start).toDateString());
  });
  return Object.values(hourMap).some(days => days.size >= 3);
}

function getMaxTypesInDay(sessions) {
  const dayTypes = {};
  sessions.forEach(s => {
    if (!s.type) return;
    const day = s._date || new Date(s.start).toDateString();
    if (!dayTypes[day]) dayTypes[day] = new Set();
    dayTypes[day].add(s.type);
  });
  return Math.max(0, ...Object.values(dayTypes).map(s => s.size));
}

function getDistinctBristolTypes(sessions) {
  return new Set(sessions.filter(s => s.type).map(s => s.type)).size;
}

function getMaxSessionsInDay(sessions) {
  const dayCount = {};
  sessions.forEach(s => {
    const day = s._date || new Date(s.start).toDateString();
    dayCount[day] = (dayCount[day] || 0) + 1;
  });
  return Math.max(0, ...Object.values(dayCount));
}

function getMaxDayDuration(sessions) {
  const dayDur = {};
  sessions.forEach(s => {
    const day = s._date || new Date(s.start).toDateString();
    dayDur[day] = (dayDur[day] || 0) + (s.duration || 0);
  });
  return Math.max(0, ...Object.values(dayDur));
}

function countNotes(sessions) {
  return sessions.filter(s => s.note && s.note.trim().length > 0).length;
}

function getConsecutiveMorningDays(sessions) {
  const morningDays = new Set();
  sessions.forEach(s => {
    const h = new Date(s.start).getHours();
    if (h >= 5 && h < 8) morningDays.add(new Date(s.start).toDateString());
  });
  const sorted = [...morningDays].sort().reverse();
  if (!sorted.length) return 0;
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = new Date(sorted[i]);
    const d2 = new Date(sorted[i + 1]);
    if ((d1 - d2) / 86400000 <= 1.5) streak++;
    else break;
  }
  return streak;
}

function getConsecutiveWeekendWeeks(sessions) {
  // Check consecutive weeks where both Sat & Sun have records
  const weekends = {};
  sessions.forEach(s => {
    const d = new Date(s.start);
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) {
      // Get ISO week start (Monday)
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const weekKey = monday.toDateString();
      if (!weekends[weekKey]) weekends[weekKey] = { sat: false, sun: false };
      if (day === 6) weekends[weekKey].sat = true;
      if (day === 0) weekends[weekKey].sun = true;
    }
  });
  const sortedWeeks = Object.keys(weekends).sort().reverse();
  let streak = 0;
  for (const wk of sortedWeeks) {
    if (weekends[wk].sat && weekends[wk].sun) streak++;
    else break;
  }
  return streak;
}

function countDistinctHours(sessions) {
  const hours = new Set();
  sessions.forEach(s => {
    hours.add(new Date(s.start).getHours());
  });
  return hours.size;
}

function hasThreeCloseDurations(sessions) {
  const durations = sessions.map(s => s.duration).filter(d => d > 0);
  for (let i = 0; i < durations.length; i++) {
    const close = durations.filter(d => Math.abs(d - durations[i]) <= 120);
    if (close.length >= 3) return true;
  }
  return false;
}

// --- All Achievements (35) ---

const ALL = [
  // ========== Original 11 ==========
  { id: 'first_log', icon: '🎉', name: '初次打卡', desc: '完成第一次记录', category: 'milestone',
    check(sessions) { return sessions.length >= 1; },
    progress(sessions) { return { current: Math.min(sessions.length, 1), target: 1 }; }
  },
  { id: 'early_bird', icon: '🌅', name: '早起第一泡', desc: '在早上6:00-8:00间记录', category: 'fun',
    check(sessions) { return sessions.some(s => { const h = new Date(s.start).getHours(); return h >= 6 && h < 8; }); }
  },
  { id: 'speed_king', icon: '⚡', name: '闪电侠', desc: '单次少于3分钟', category: 'speed',
    check(sessions) { return sessions.some(s => s.duration < 180); }
  },
  { id: 'marathon', icon: '🏃', name: '肠道马拉松', desc: '单次超过15分钟', category: 'fun',
    check(sessions) { return sessions.some(s => s.duration > 900); }
  },
  { id: 'triple', icon: '3️⃣', name: '一日三次', desc: '同一天记录3次以上', category: 'quantity',
    check(s) { return getMaxSessionsInDay(s) >= 3; }
  },
  { id: 'type4', icon: '🍌', name: '黄金标准', desc: '记录到布里斯托4型', category: 'collection',
    check(sessions) { return sessions.some(s => s.type === 4); }
  },
  { id: 'streak_3', icon: '🔥', name: '三天连击', desc: '连续3天记录', category: 'streak',
    check(sessions, allDays) { return checkStreak(allDays, 3); },
    progress(sessions, allDays) { return { current: Math.min(getStreakLength(allDays), 3), target: 3 }; }
  },
  { id: 'streak_7', icon: '💎', name: '一周全勤', desc: '连续7天记录', category: 'streak',
    check(sessions, allDays) { return checkStreak(allDays, 7); },
    progress(sessions, allDays) { return { current: Math.min(getStreakLength(allDays), 7), target: 7 }; }
  },
  { id: 'ten_total', icon: '🔟', name: '十全十美', desc: '累计记录10次', category: 'milestone',
    check(sessions, allDays, totalCount) { return totalCount >= 10; },
    progress(sessions, allDays, totalCount) { return { current: Math.min(totalCount, 10), target: 10 }; }
  },
  { id: 'fifty_total', icon: '🏆', name: '半百里程碑', desc: '累计记录50次', category: 'milestone',
    check(sessions, allDays, totalCount) { return totalCount >= 50; },
    progress(sessions, allDays, totalCount) { return { current: Math.min(totalCount, 50), target: 50 }; }
  },
  { id: 'night_owl', icon: '🦉', name: '夜猫子', desc: '在晚上22:00后记录', category: 'fun',
    check(sessions) { return sessions.some(s => { const h = new Date(s.start).getHours(); return h >= 22; }); }
  },

  // ========== Original v2.0 7 ==========
  { id: 'map_explorer', icon: '🗺️', name: '地图探索者', desc: '在5个以上地点记录', category: 'collection',
    check(sessions) { return countDistinctLocations(sessions) >= 5; },
    progress(sessions) { return { current: Math.min(countDistinctLocations(sessions), 5), target: 5 }; }
  },
  { id: 'social_baby', icon: '👥', name: '社交达人', desc: '添加3个以上好友', category: 'social',
    check(s, d, t, friends) { return friends >= 3; },
    progress(s, d, t, friends) { return { current: Math.min(friends || 0, 3), target: 3 }; }
  },
  { id: 'precision', icon: '🎯', name: '精准时钟', desc: '同一时段记录3天以上', category: 'fun',
    check(sessions) { return hasPrecisionTime(sessions); }
  },
  { id: 'traveler', icon: '✈️', name: '环球旅行家', desc: '在3个以上城市记录', category: 'collection',
    check(sessions) { return countDistinctCities(sessions) >= 3; },
    progress(sessions) { return { current: Math.min(countDistinctCities(sessions), 3), target: 3 }; }
  },
  { id: 'lucky_7', icon: '🍀', name: '幸运七', desc: '单次恰好7分钟', category: 'fun',
    check(sessions) { return sessions.some(s => s.duration >= 415 && s.duration <= 425); }
  },
  { id: 'full_house', icon: '🃏', name: '满堂红', desc: '一天记录4种以上类型', category: 'collection',
    check(sessions) { return getMaxTypesInDay(sessions) >= 4; }
  },
  { id: 'century', icon: '💯', name: '百年树人', desc: '累计记录100次', category: 'milestone',
    check(sessions, allDays, totalCount) { return totalCount >= 100; },
    progress(sessions, allDays, totalCount) { return { current: Math.min(totalCount, 100), target: 100 }; }
  },

  // ========== NEW: 收集类 (3) ==========
  { id: 'type_collector_bronze', icon: '🥉', name: '类型新秀', desc: '收集3种Bristol类型', category: 'collection',
    check(sessions) { return getDistinctBristolTypes(sessions) >= 3; },
    progress(sessions) { const n = getDistinctBristolTypes(sessions); return { current: Math.min(n, 3), target: 3 }; }
  },
  { id: 'type_collector_silver', icon: '🥈', name: '类型猎手', desc: '收集5种Bristol类型', category: 'collection',
    check(sessions) { return getDistinctBristolTypes(sessions) >= 5; },
    progress(sessions) { const n = getDistinctBristolTypes(sessions); return { current: Math.min(n, 5), target: 5 }; }
  },
  { id: 'type_collector_gold', icon: '👑', name: '类型大师', desc: '收集全部7种Bristol类型', category: 'collection',
    check(sessions) { return getDistinctBristolTypes(sessions) >= 7; },
    progress(sessions) { const n = getDistinctBristolTypes(sessions); return { current: Math.min(n, 7), target: 7 }; }
  },

  // ========== NEW: 效率类 (3) ==========
  { id: 'one_minute', icon: '💨', name: '光速解决', desc: '单次少于1分钟', category: 'speed',
    check(sessions) { return sessions.some(s => s.duration > 0 && s.duration < 60); }
  },
  { id: 'ten_minute_mark', icon: '🔟', name: '十分钟整', desc: '单次恰好10分钟（±15秒）', category: 'fun',
    check(sessions) { return sessions.some(s => s.duration >= 585 && s.duration <= 615); }
  },
  { id: 'time_lord', icon: '🕐', name: '时间领主', desc: '3次记录时长在±2分钟内', category: 'speed',
    check(sessions) { return hasThreeCloseDurations(sessions); }
  },

  // ========== NEW: 坚持类 (4) ==========
  { id: 'morning_streak_5', icon: '🌄', name: '早起冠军', desc: '连续5天8:00前记录', category: 'streak',
    check(sessions) { return getConsecutiveMorningDays(sessions) >= 5; },
    progress(sessions) { return { current: Math.min(getConsecutiveMorningDays(sessions), 5), target: 5 }; }
  },
  { id: 'perfect_week', icon: '📅', name: '完美一周', desc: '一周7天全勤', category: 'streak',
    check(sessions, allDays) { return checkStreak(allDays, 7); },
    progress(sessions, allDays) { return { current: Math.min(getStreakLength(allDays), 7), target: 7 }; }
  },
  { id: 'streak_14', icon: '🔥', name: '双周连击', desc: '连续14天打卡', category: 'streak',
    check(sessions, allDays) { return checkStreak(allDays, 14); },
    progress(sessions, allDays) { return { current: Math.min(getStreakLength(allDays), 14), target: 14 }; }
  },
  { id: 'streak_30', icon: '💎', name: '月度满贯', desc: '连续30天打卡', category: 'streak',
    check(sessions, allDays) { return checkStreak(allDays, 30); },
    progress(sessions, allDays) { return { current: Math.min(getStreakLength(allDays), 30), target: 30 }; }
  },

  // ========== NEW: 数量/里程碑类 (4) ==========
  { id: 'two_hundred', icon: '💯', name: '两百大关', desc: '累计记录200次', category: 'milestone',
    check(sessions, allDays, totalCount) { return totalCount >= 200; },
    progress(sessions, allDays, totalCount) { return { current: Math.min(totalCount, 200), target: 200 }; }
  },
  { id: 'five_hundred', icon: '👑', name: '五百传奇', desc: '累计记录500次', category: 'milestone',
    check(sessions, allDays, totalCount) { return totalCount >= 500; },
    progress(sessions, allDays, totalCount) { return { current: Math.min(totalCount, 500), target: 500 }; }
  },
  { id: 'heavy_day', icon: '🏋️', name: '重量级选手', desc: '单日总时长超60分钟', category: 'quantity',
    check(sessions) { return getMaxDayDuration(sessions) >= 3600; },
    progress(sessions) { return { current: Math.min(Math.floor(getMaxDayDuration(sessions) / 60), 60), target: 60, unit: '分' }; }
  },
  { id: 'double_trouble', icon: '4️⃣', name: '一日四次', desc: '一天内记录4次以上', category: 'quantity',
    check(sessions) { return getMaxSessionsInDay(sessions) >= 4; }
  },

  // ========== NEW: 趣味类 (3) ==========
  { id: 'note_master', icon: '📝', name: '笔记达人', desc: '写了20条备注', category: 'fun',
    check(sessions) { return countNotes(sessions) >= 20; },
    progress(sessions) { return { current: Math.min(countNotes(sessions), 20), target: 20 }; }
  },
  { id: 'weekend_champion', icon: '🎉', name: '周末战士', desc: '连续4周周末都记录', category: 'streak',
    check(sessions) { return getConsecutiveWeekendWeeks(sessions) >= 4; },
    progress(sessions) { return { current: Math.min(getConsecutiveWeekendWeeks(sessions), 4), target: 4, unit: '周' }; }
  },
  { id: 'hourly_explorer', icon: '🕖', name: '全时段探索者', desc: '6个不同小时段有记录', category: 'fun',
    check(sessions) { return countDistinctHours(sessions) >= 6; },
    progress(sessions) { return { current: Math.min(countDistinctHours(sessions), 6), target: 6 }; }
  },
];

// --- Public API ---

function getUnlocked(sessions, allDays, totalCount, friendCount) {
  return ALL.filter(a => a.check(sessions, allDays, totalCount, friendCount)).map(a => a.id);
}

function getAllWithProgress(sessions, allDays, totalCount, friendCount) {
  return ALL.map(a => {
    const unlocked = a.check(sessions, allDays, totalCount, friendCount);
    let progress = null;
    if (!unlocked && a.progress) {
      progress = a.progress(sessions, allDays, totalCount, friendCount);
    }
    return { ...a, unlocked, progress };
  });
}

module.exports = { ALL, getUnlocked, getAllWithProgress, getDistinctBristolTypes };
