# AI 魔力面试前端

基于 Next.js 16 的实时视频面试模拟系统，通过 AI 技术帮助用户练习面试技能。支持简历解析、职位导入、实时视频面试、多维度评估和详细报告生成。

## 功能特性

- **简历上传与解析** - 支持 PDF/DOCX 格式简历自动解析
- **BOSS直聘职位导入** - 自动抓取并解析 BOSS直聘 JD 信息
- **实时视频面试** - 基于 MediaPipe 的人脸检测实时面试
- **WebSocket 实时通信** - 全双工实时消息传递
- **Opus 音频流** - TTS 音频流播放与用户录音上传
- **语音活动检测 (VAD)** - 自动检测用户说话开始与结束
- **抢话支持 (Barge-in)** - 用户可在 TTS 播放时打断
- **多维度评估** - 准确性、逻辑性、流畅度、自信度、情绪、肢体语言、语音语调
- **Markdown 报告** - 带目录导航的详细评估报告
- **Mock 模式** - 离线开发模式，无需后端
- **深色/浅色主题** - 青色 (cyan) 主色调

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI 库**: React 18 + TypeScript
- **样式**: Tailwind CSS v4
- **组件库**: shadcn/ui + Radix UI
- **状态管理**: Zustand
- **实时通信**: WebSocket
- **媒体处理**: MediaPipe, Web Audio API, Ogg Opus
- **包管理**: pnpm

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:3000

### Mock 模式（无需后端）

```bash
pnpm mock
```

### 生产构建

```bash
pnpm build
pnpm start
```

### 代码检查

```bash
pnpm lint
```

## 项目结构

```
interview-agent-frontend/
├── app/                          # Next.js App Router 页面
│   ├── layout.tsx               # 根布局（主题 Provider）
│   ├── page.tsx                 # 首页 - 面试表单
│   ├── globals.css              # 全局样式
│   ├── interview/
│   │   └── session/
│   │       └── page.tsx         # 面试会话页面
│   └── report/
│       └── [sessionId]/
│           └── page.tsx         # 报告查看页面
├── components/                   # React 组件
│   ├── ui/                      # shadcn/ui 基础组件
│   ├── InterviewForm.tsx        # 面试信息表单
│   ├── VideoInterview.tsx       # 视频面试主组件
│   ├── QuestionDisplay.tsx      # 题目展示
│   ├── EmotionDisplay.tsx       # 情绪展示
│   ├── ReportDisplay.tsx        # 报告展示
│   ├── ReportTocNav.tsx         # 报告目录导航
│   ├── ThemeProvider.tsx        # 主题 Provider
│   └── ThemeToggle.tsx          # 主题切换
├── lib/                          # 核心库
│   ├── api.ts                   # API 封装 + WebSocket 客户端
│   ├── createWebSocketClient.ts # WebSocket 工厂函数
│   ├── mockWebSocketClient.ts   # Mock WebSocket 实现
│   ├── audioEncoderManager.ts   # 麦克风录音管理
│   ├── audioStreamManager.ts    # 音频流播放管理
│   ├── vad.ts                   # 语音活动检测
│   ├── oggMuxer.ts              # Ogg 封装
│   ├── fileParser.ts            # 简历解析
│   ├── bossParser.ts            # BOSS JD 解析
│   ├── normalizeReportMarkdown.ts # 报告 Markdown 规范化
│   └── utils.ts                 # 工具函数
├── store/                        # Zustand 状态管理
│   └── interviewStore.ts        # 面试状态存储
├── hooks/                        # 自定义 Hooks
│   └── useAudioPlayback.ts      # 音频播放 Hook
├── mock/                         # Mock 数据
│   ├── data/
│   │   ├── questions.ts         # 面试题库
│   │   ├── evaluations.ts       # 评估结果生成
│   │   └── report.ts            # 报告生成
│   └── README.md                # Mock 模式说明
├── types/                        # TypeScript 类型定义
├── public/                       # 静态资源
├── docs/                         # 文档
│   ├── websocket.md             # WebSocket 协议文档
│   └── final_report.md          # 报告格式示例
├── next.config.ts               # Next.js 配置
├── tsconfig.json                # TypeScript 配置
└── package.json                 # 项目依赖
```

## 架构概述

### WebSocket 通信架构

系统采用工厂模式区分真实与 Mock WebSocket 客户端：

1. **连接建立**: `createWebSocketClient()` 根据 `NEXT_PUBLIC_MOCK_MODE` 环境变量返回对应客户端
2. **消息流程**: 面试会话通过消息事件驱动 (`session_created`, `new_question`, `evaluation_result`, `final_report`)
3. **API 一致性**: Mock 客户端完全模拟真实后端行为，包括连接延迟、题目生成、评估返回等

### 音频管道

系统采用双通道音频处理：

**录音通道 (麦克风 → 服务器)**:
1. 麦克风采集 → Web Audio API 48kHz 采样
2. `AudioEncoderManager` 降采样至 16kHz PCM
3. 编码后通过 WebSocket 上传

**播放通道 (服务器 → 扬声器)**:
1. 服务器发送 Ogg Opus 音频流
2. `AudioStreamManager` 解码 (ogg-opus-decoder)
3. Web Audio API 播放

### VAD (语音活动检测)

采用自适应双阈值带迟滞的检测算法：
- 检测用户开始说话 → 自动开始录音
- 检测用户停止说话 → 自动结束录音
- 支持抢话 (Barge-in): 用户开始说话时停止当前 TTS

### 视频处理

- 使用 MediaPipe Face Detection 进行实时人脸检测
- 面试过程中分析面部表情和肢体语言
- 用于评估自信度和情绪表现

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `API_BASE_URL` | REST API 地址 | 空 (使用 Next.js 代理) |
| `WS_BASE_URL` | WebSocket 地址 | ws://localhost:8080 |
| `NEXT_PUBLIC_MOCK_MODE` | 启用 Mock 模式 | false |

**说明**:
- `API_BASE_URL` 为空时，API 请求通过 Next.js 代理到后端 (localhost:8080)
- `WS_BASE_URL` 直接指定 WebSocket 服务器地址

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页 - 填写面试信息（简历、JD、面试配置）|
| `/interview/session` | 视频面试会话页面 |
| `/report/[sessionId]` | 面试报告查看页面 |

## Mock 模式

Mock 模式允许在无后端服务的情况下完整测试所有面试功能：

**启动方式**: `pnpm mock` (设置 `NEXT_PUBLIC_MOCK_MODE=true`)

**模拟流程**:
1. 连接模拟 (300ms 延迟)
2. 自我介绍环节
3. 技术题/业务题/追问 循环
4. 每题自动生成评估结果
5. 面试结束生成完整报告

Mock 模式下页面右下角显示 "Mock Mode" 徽章。详见 [mock/README.md](mock/README.md)。
