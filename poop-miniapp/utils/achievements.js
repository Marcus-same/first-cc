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
  // Same hour (±30min) on 3+ different days
  const hourMap = {};
  sessions.forEach(s => {
    const d = new Date(s.start);
    const h = d.getHours();
    if (!hourMap[h]) hourMap[h] = new Set();
    hourMap[h].add(new Date(s.start).toDateString());
  });
  return Object.values(hourMap).some(days => days.size >= 3);
}

function getTypeCountInDay(sessions) {
  // Max distinct types in a single day
  const dayTypes = {};
  sessions.forEach(s => {
    if (!s.type) return;
    const day = s._date || new Date(s.start).toDateString();
    if (!dayTypes[day]) dayTypes[day] = new Set();
    dayTypes[day].add(s.type);
  });
  return Math.max(0, ...Object.values(dayTypes).map(s => s.size));
}

const ALL = [
  // Original 11
  { id: 'first_log', icon: '🎉', name: '初次打卡', desc: '完成第一次记录', check(sessions) { return sessions.length >= 1; } },
  { id: 'early_bird', icon: '🌅', name: '早起第一泡', desc: '在早上6:00-8:00间记录', check(sessions) { return sessions.some(s => { const h = new Date(s.start).getHours(); return h >= 6 && h < 8; }); } },
  { id: 'speed_king', icon: '⚡', name: '闪电侠', desc: '单次少于3分钟', check(sessions) { return sessions.some(s => s.duration < 180); } },
  { id: 'marathon', icon: '🏃', name: '肠道马拉松', desc: '单次超过15分钟', check(sessions) { return sessions.some(s => s.duration > 900); } },
  { id: 'triple', icon: '3️⃣', name: '一日三次', desc: '同一天记录3次以上', check(s) { return s.length >= 3; } },
  { id: 'type4', icon: '🍌', name: '黄金标准', desc: '记录到布里斯托4型', check(sessions) { return sessions.some(s => s.type === 4); } },
  { id: 'streak_3', icon: '🔥', name: '三天连击', desc: '连续3天记录', check(sessions, allDays) { return checkStreak(allDays, 3); } },
  { id: 'streak_7', icon: '💎', name: '一周全勤', desc: '连续7天记录', check(sessions, allDays) { return checkStreak(allDays, 7); } },
  { id: 'ten_total', icon: '🔟', name: '十全十美', desc: '累计记录10次', check(sessions, allDays, totalCount) { return totalCount >= 10; } },
  { id: 'fifty_total', icon: '🏆', name: '半百里程碑', desc: '累计记录50次', check(sessions, allDays, totalCount) { return totalCount >= 50; } },
  { id: 'night_owl', icon: '🦉', name: '夜猫子', desc: '在晚上22:00后记录', check(sessions) { return sessions.some(s => { const h = new Date(s.start).getHours(); return h >= 22; }); } },

  // New 7
  { id: 'map_explorer', icon: '🗺️', name: '地图探索者', desc: '在5个以上地点记录', check(sessions) { return countDistinctLocations(sessions) >= 5; } },
  { id: 'social_baby', icon: '👥', name: '社交达人', desc: '添加3个以上好友', check(s, d, t, friends) { return friends >= 3; } },
  { id: 'precision', icon: '🎯', name: '精准时钟', desc: '同一时段记录3天以上', check(sessions) { return hasPrecisionTime(sessions); } },
  { id: 'traveler', icon: '✈️', name: '环球旅行家', desc: '在3个以上城市记录', check(sessions) { return countDistinctCities(sessions) >= 3; } },
  { id: 'lucky_7', icon: '🍀', name: '幸运七', desc: '单次恰好7分钟', check(sessions) { return sessions.some(s => s.duration >= 415 && s.duration <= 425); } },
  { id: 'full_house', icon: '🃏', name: '满堂红', desc: '一天记录4种以上类型', check(sessions) { return getTypeCountInDay(sessions) >= 4; } },
  { id: 'century', icon: '💯', name: '百年树人', desc: '累计记录100次', check(sessions, allDays, totalCount) { return totalCount >= 100; } },
];

function getUnlocked(sessions, allDays, totalCount, friendCount) {
  return ALL.filter(a => a.check(sessions, allDays, totalCount, friendCount)).map(a => a.id);
}

module.exports = { ALL, getUnlocked };
