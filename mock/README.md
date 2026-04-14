# Mock Mode

本项目支持 **Mock 模式**，无需后端服务即可完整运行所有面试功能。

## 启动方式

```bash
pnpm mock
```

此命令会启动 Next.js 开发服务器，并设置 `NEXT_PUBLIC_MOCK_MODE=true` 环境变量。

## 架构设计

### 核心理念

- **工厂模式**：`createWebSocketClient()` 根据环境变量返回真实或 Mock 客户端
- **零侵入**：Mock 代码完全隔离，生产代码仅需一行修改
- **API 一致**：MockWebSocketClient 与 WebSocketClient 公开 API 完全一致

### 目录结构

```
mock/
├── data/
│   ├── questions.ts     # 中文面试题库（技术题 + 业务题 + 追问）
│   ├── evaluations.ts   # 评估结果生成器（随机但合理的分数）
│   └── report.ts        # Markdown 报告生成器
└── README.md            # 本文档

lib/
├── api.ts               # 原有 API 层 + 工厂函数导出
├── createWebSocketClient.ts  # 工厂函数
└── mockWebSocketClient.ts    # Mock WebSocket 客户端
```

### 面试流程模拟

MockWebSocketClient 完整模拟真实后端行为：

1. `connect()` → 模拟连接延迟 300ms
2. `sendStartInterview()` →
   - 发送 `session_created`
   - 发送 `self_intro`
3. `sendSelfIntroComplete()` → 开始提问循环
4. 对每道题：
   - 发送 `audio_question_error`（TTS 降级，纯文字模式）
   - 发送 `new_question`
   - 等待 `sendAnswerComplete()`
   - 发送 `answer_received`
   - 发送 `evaluation_result`（随机生成的评分）
5. 所有题目完成 → 发送 `final_report`

### 题目生成逻辑

- 按配置的技术题数、业务题数、追问数生成
- 追问随机插入到题目序列中
- 题库循环使用，支持任意数量

### 评估结果生成

- 分数范围：60-95（随机但合理）
- 优缺点从预设池中随机抽取
- 综合分按权重计算

## 视觉标识

Mock 模式下，页面右下角显示 "Mock Mode" 徽章，便于区分。

## 注意事项

- Mock 模式不支持真实 TTS 音频播放（使用 `audio_question_error` 降级）
- 视频/音频数据被静默消费，不模拟处理
- 报告页面 `/report/[sessionId]` 会生成模拟报告
