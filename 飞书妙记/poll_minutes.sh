#!/bin/bash
# 妙记轮询：每30分钟检查一次，发现新妙记写入 pending 文件
PROCESSED_FILE="D:/first-cc/飞书妙记/.minutes_processed"
PENDING_FILE="D:/first-cc/飞书妙记/.minutes_pending"
SLEEP_SEC=1800  # 30分钟

while true; do
  TODAY=$(date +%Y-%m-%d)

  # 搜索今日妙记
  RESULT=$(lark-cli --as user minutes +search --owner-ids me --start "$TODAY" --end "$TODAY" --page-size 10 2>/dev/null)

  # 提取 tokens
  TOKENS=$(echo "$RESULT" | grep -o '"token": "[^"]*"' | cut -d'"' -f4)

  # 读取已处理列表
  PROCESSED=$(cat "$PROCESSED_FILE" 2>/dev/null || echo "[]")

  for TOKEN in $TOKENS; do
    if ! echo "$PROCESSED" | grep -q "$TOKEN"; then
      # 新妙记，追加到 pending
      if [ ! -f "$PENDING_FILE" ]; then
        echo "[]" > "$PENDING_FILE"
      fi
      if ! grep -q "$TOKEN" "$PENDING_FILE"; then
        # 用 Python 处理 JSON 追加
        python -c "
import json
with open('$PENDING_FILE', 'r') as f:
    pending = json.load(f)
if '$TOKEN' not in pending:
    pending.append('$TOKEN')
    with open('$PENDING_FILE', 'w') as f:
        json.dump(pending, f)
    print('PENDING: $TOKEN')
"
      fi
    fi
  done

  sleep $SLEEP_SEC
done
