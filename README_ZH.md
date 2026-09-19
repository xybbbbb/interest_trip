# interest-mcp（兴趣地点 + 证据服务 · 原型）

这是「Interest-Driven Travel Assistant」第一阶段的独立原型：一个符合 MCP（Streamable HTTP）协议的兴趣地点服务，用 **CORTIS × Seoul 示例数据**演示完整链路：

```text
兴趣/艺人关键词
    → 发现关联地点（场馆 / 咖啡馆 / MV 取景地 / 打卡点）
    → 每条地点携带证据链（来源、链接、时间、置信度）
    → 供任意 MCP 客户端（行程规划应用）调用并生成行程
```

设计原则与项目 README 一致：**地点与证据是可追溯的结构化数据，不是 LLM 随口生成的文字**。

## ⚠️ 重要说明

`data/seoul-cortis-demo.json` 是**演示用占位数据**，不包含任何真实调研结论：

- 地点名称带“示例/Demo”标识；
- 证据链接统一使用 `example.com`；
- 坐标、营业时间仅用于展示字段结构。

正式版本必须用真实来源（官方物料、多方粉丝信源、媒体等）逐条核验后再替换本数据集。

## 目录

```text
interest-mcp/
├── server.mjs               # MCP Streamable HTTP 服务（零第三方依赖）
├── smoke-test.mjs           # 协议冒烟测试：initialize → tools/list → tools/call
├── package.json
├── web-preview/
│   └── index.html           # 可双击打开的产品界面原型（CORTIS × Seoul）
├── docs/
│   └── visitseoul-fields.md     # VisitSeoul 字段 → 本项目 schema 映射与清洗规则
├── scripts/
│   └── visitseoul-fetch.mjs     # VisitSeoul 抓取脚本骨架（Key 就绪后使用）
└── data/
    └── seoul-cortis-demo.json  # CORTIS × Seoul 演示地点与证据
```

## 网页界面原型

`web-preview/index.html` 是一个**自包含的界面原型**，不需要安装依赖、不需要服务器，双击即可在浏览器打开。它演示产品主流程：

```text
用户说出旅行动机（对 CORTIS 感兴趣 / 想看演唱会 / 想在首尔旅行）
    → AI 展示处理优先级：P0 演唱会 → P1 CORTIS 相关地点（带证据） → P2 首尔观光
    → 用户给粉丝地点标“必去 / 顺路再去”，并选择观光点
    → 用户回答天数、演唱会日期、节奏、预算、到达离开时间、住宿策略
    → 生成带地图的路线（默认全部行程总览，可切换按天分开；每段给时间估算与“为什么这样排”）
    → 演唱会日 19:00 后自动留白
    → 按住宿策略推荐酒店（紫色图钉），支持逐日改选
    → 低置信度地点可一键隐藏，进入行程时带 ⚠ 提示
    → 支持把安排“移到其他天”做基础调整
```

地图使用 Leaflet + OpenStreetMap（联网时自动加载，离线时回退为文字排程）。页面中所有地点、证据、住宿、时间估算与路线均为演示占位数据，不代表真实调研结论；接入真实数据与确定性排程引擎后再替换。

## 本地运行

需要 Node.js 20+（本项目测试时使用 Node 22）。

```bash
node server.mjs
```

默认监听 `http://127.0.0.1:8788/mcp`，可用环境变量覆盖：

```bash
INTEREST_MCP_HOST=127.0.0.1 INTEREST_MCP_PORT=8788 node server.mjs
```

浏览器访问 `http://127.0.0.1:8788/` 可查看健康信息。

## VisitSeoul 官方观光数据（Key 已核验）

项目 P2「首尔普通观光地点池」使用 VisitSeoul OpenAPI。API Key 已于 2026-09-09 核验可用，`langs` / `categories` / `list` / `info` 四个接口均已实测通过：

- [docs/visitseoul-fields.md](docs/visitseoul-fields.md)：API 端点、认证方式、抓取流程、字段映射表、数据清洗规则与“不做的事”。
- [scripts/visitseoul-fetch.mjs](scripts/visitseoul-fetch.mjs)：零依赖抓取脚本骨架，支持 `langs` / `categories` / `list` / `info` 四个命令。

实际可用 Base URL 为 `https://api-call.visitseoul.net/api/v1`（官方概览页写作 `call-api.visitseoul.net`，但该域名无法解析）。后续按文档第 7 节执行小批量核验与批量导入：

```bash
$env:VISITSEOUL_API_KEY = "你的key"
node scripts/visitseoul-fetch.mjs langs
node scripts/visitseoul-fetch.mjs categories --lang en
node scripts/visitseoul-fetch.mjs list --category <com_ctgry_sn> --lang zh-CN --max-pages 1
node scripts/visitseoul-fetch.mjs info <cid> --lang en
```

先用小批量数据人工核对字段，再批量抓取并转换成 `data/visitseoul-seoul.json`。**VisitSeoul 是普通观光地点池，不含“CORTIS 去过哪里”的粉丝数据**；粉丝地点仍走独立策展 + 证据链流程。

## 冒烟测试

```bash
node smoke-test.mjs
```

测试覆盖 MCP 协议步骤：

1. `initialize`（协议版本 2025-06-18）
2. `notifications/initialized`
3. `tools/list`
4. `tools/call search_interest_places`
5. `tools/call get_place_evidence`
6. 未知工具错误处理

## 对外工具

| 工具 | 作用 |
|---|---|
| `search_interest_places` | 按兴趣/艺人关键词与类型筛选首尔关联地点，返回地点 + 证据概况 |
| `get_place_evidence` | 按 `placeId` 返回完整证据链 |
| `list_demo_interests` | 列出演示数据支持的兴趣标签与地点分类 |

`search_interest_places` 参数示例：

```json
{
  "interest": "CORTIS",
  "city": "Seoul",
  "categories": ["concert_venue", "cafe"]
}
```

## 路线图

- [x] MCP 服务骨架 + 证据字段模型
- [x] CORTIS × Seoul 演示数据集
- [x] 协议冒烟测试
- [x] VisitSeoul 字段映射文档 + 抓取脚本骨架（待 Key 实测）
- [ ] 接入 VisitSeoul 真实首尔观光数据（等 API Key）
- [ ] 粉丝地点收集与证据核验管线（官方 / 媒体 / 多源社区）
- [ ] 确定性排程引擎：距离、通勤时间、营业时间与冲突校验
- [ ] 证据分级驱动行程权重（低置信度地点降权 / 标注）
