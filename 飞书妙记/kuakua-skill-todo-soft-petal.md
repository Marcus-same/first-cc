# 妙记自动捕获：录音完自动生成纪要

## Context

当前流程最后一步「复制妙记链接发给 Claude Code」仍需手动操作。用户在手机上录完音，飞书自动转写完成后，希望能自动检测到新妙记并触发智能纪要生成，最终文档链接推送到 Bridge 群。

技术约束：
- 飞书没有 minutes 相关的事件订阅（无法实时推送）
- `minutes +search` 支持按时间范围过滤，但不支持排序
- 无法通过 URL scheme 触发录音完成通知

## 方案：后台轮询 + Claude Code 定时处理

### 整体架构

```
手机录音 → 飞书自动转写 → [新妙记产生]
                              ↓
         minutes_watcher.py (每5分钟轮询)
         检测新妙记 → 发链接到 Bridge 群
                              ↓
         Claude Code Cron (每10分钟检查)
         读到 Bridge 新妙记消息 → 触发 smart-minutes
         → 生成纪要文档 → 文档链接发到 Bridge 群
                              ↓
         用户在 Bridge 群收到纪要链接
```

### 组件1：minutes_watcher.py

新建 `D:\first-cc\minutes_watcher.py`，复用 `bridge_poll.py` 的轮询模式：

- **轮询**：每 5 分钟调用 `lark-cli --as user minutes +search --owner-ids me --start <today> --end <today>`
- **去重**：`.minutes_seen` 文件存储已处理的 `minute_token` 集合
- **推送**：发现新妙记 → 发消息到 Bridge 群：`📋 新妙记：{title} {url}` （不加触发词，仅做通知）
- **运行方式**：`python minutes_watcher.py --daemon` 后台常驻
- **编码处理**：复用 `ingest_hr.py` 的 `_run_lark_cli()` 方式绕过 Windows 编码问题

### 组件2：Cron 定时触发 smart-minutes

用 `CronCreate` 创建 durable cron job，每 10 分钟执行：

```
检查 Bridge 群最近消息，如果有妙记链接（feishu.cn/minutes/）且未处理过，
则运行 smart-minutes 工作流：
  提取 minute_token → vc +notes 获取逐字稿 → 分析 → 生成飞书 Doc → 发链接到 Bridge
```

去重逻辑：在 memory 中记录已处理的 minute_token，避免重复生成。

### 链路时序

| 时间 | 事件 |
|------|------|
| T+0 | 用户按 Action Button 开始录音 |
| T+N | 会议结束，停止录音 |
| T+N+2min | 飞书转写完成，新妙记产生 |
| T+N+7min | minutes_watcher 检测到新妙记，发通知到 Bridge |
| T+N+17min | Cron 触发，Claude Code 处理妙记，生成纪要 Doc |
| T+N+17.5min | 纪要链接发到 Bridge，用户手机上看到 |

**总延迟：录音结束后约 15-20 分钟拿到纪要。**

### 优化：即时处理路径

如果用户开完会想立刻拿到纪要（不想到等 cron），仍可手动复制链接发过来，smart-minutes 实时处理。手动路径和自动路径共存，互不冲突。

## 实现文件

1. **新建 `D:\first-cc\minutes_watcher.py`**
   - `_run_lark()` — lark-cli 调用封装（复用 `ingest_hr.py` 模式）
   - `search_recent_minutes()` — 搜索今日新妙记
   - `load_seen_tokens()` / `save_seen_token()` — 状态管理（`.minutes_seen`）
   - `send_bridge_notification()` — 发通知到 Bridge 群
   - `run_once()` — 单次检查
   - `run_daemon()` — 后台轮询（默认 300 秒间隔）

2. **Cron job** — 通过 `CronCreate` 创建，每 10 分钟触发 smart-minutes 处理 Bridge 中的未处理妙记

3. **可选：扩展 bridge_poll.py** — 添加「纪要」关键词识别，手动发到 Bridge 的妙记链接也能被 bridge_poll 识别并通知 Claude Code 处理

## 验证计划

1. 启动 `minutes_watcher.py --daemon`，确认能检测到今日妙记
2. 手动创建一个测试妙记（或用已有），确认 watcher 能识别为「新」并推送到 Bridge
3. 创建 cron job，确认能读取 Bridge 消息并触发 smart-minutes
4. 端到端测试：录音 → 等转写 → watcher 推送 → cron 处理 → Bridge 收到纪要链接
