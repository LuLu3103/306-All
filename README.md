# 西综学习台（讲义进度看板 + 学习转盘）

一个蓝色简约风格的静态学习网站，把两件事合在同一个页面里：

1. **进度看板**：跟踪医学五大学科（生理、病理、内科、外科、生化）讲义任务的完成情况
2. **学习转盘**：抽签决定今天的学习时长，带倒计时、任务栏与时长统计

- 学科顺序固定：**生理 · 病理 · 内科 · 外科 · 生化**
- 顶栏一键切换「进度看板 / 学习转盘」，不用跳转页面，地址栏 `#wheel` 直达转盘
- 纯静态站点（HTML + CSS + 原生 JavaScript），无需自己的后端，可直接托管在 GitHub Pages
- 任务数据单独放在 `data/tasks.js`，`index.html` 只保留界面结构
- 两个功能共用**同一个免登录同步码**，进度都保存在 Supabase 云端，换设备填同一个码即可继续

---

## 一、功能结构

顶栏统一为：品牌「西综讲义进度看板」+ 视图切换（进度看板 / 学习转盘）+ 五个学科按钮（生理-病理-内科-外科-生化）+ 统计按钮（下拉可收起）+ 两个外链按钮（ttsx每日计划、ttsx口诀/题库）+ 云同步状态 + 导出 / 导入 / 重置。

### 1. 进度看板

| 区域 | 说明 |
| --- | --- |
| **顶栏** | 五个学科按钮（每个显示 `已完成/总数` 与迷你进度条）+ 统计按钮（显示总进度百分比，点开是统计面板） |
| **功能栏** | 当前学科的全部任务：按章分组，可展开 / 收起；支持搜索、隐藏已完成，占满整页宽度 |
| **统计面板** | 点顶栏「统计」展开：总进度环、已完成 / 剩余 / 总任务数；分学科进度条与剩余数量；当前学科提示与云同步状态。再点一次 / 点面板外 / 按 Esc 收起 |

交互细节：

- 点击任务行或复选框即可标记完成，进度实时刷新并自动同步到云端
- 统计面板中的学科行可直接点击跳转到对应学科，面板会自动收起
- 快捷键 `1` ~ `5` 快速切换学科（生理=1，病理=2，内科=3，外科=4，生化=5，仅看板视图）
- 地址栏带 `#学科id`，刷新后停留在原学科；带 `#wheel` 直接打开学习转盘
- 手机 / 平板自适应布局

### 2. 学习转盘

| 区域 | 说明 |
| --- | --- |
| **转盘** | 30 份任务：25 份学习时长（10min ~ 2h）+ 5 份休息时长（5/10/15/20/30min），点击「抽取」旋转 |
| **任务栏** | 当天抽到的记录，可勾选完成、删除、清空当日；用日期选择器可查看往日（只读） |
| **统计栏** | 今日 / 近 7 天 / 近 30 天的学习与休息时长、完成数，支持生成环形图 + 柱状图并保存 PNG |
| **工具栏** | 实时时钟、日期切换、云同步状态、使用说明 |

玩法规则：

- 抽到**学习任务**后必须等倒计时结束才能再抽（防止连抽刷时长）
- 抽到**休息任务**可以随时「跳过休息」继续抽下一轮
- 每次抽取自动记入任务栏，并同步到云端（与看板共用同一个同步码）
- 转盘页也能单独「导出数据 / 导入数据」做 JSON 备份，「清空全部数据」会清空转盘记录

顶栏外链（新标签页打开）：

- `ttsx每日计划` → https://toashore.cn/public/apps/calendar/online/index.html?qq_aio_chat_type=2
- `ttsx口诀/题库` → https://rray1228.github.io/neike-306-tiku/?view=mnemonics

---

## 二、任务数据

看板共 **251** 项任务，全部来自 `目录/` 文件夹中五张目录图片，按"章 → 小节 / 串讲"整理：

| 学科 | 章数 | 任务数 |
| --- | ---: | ---: |
| 生理 | 12 | 59 |
| 病理 | 9 | 32 |
| 内科 | 8 | 80 |
| 外科 | 6 | 51 |
| 生化 | 2 | 29 |
| **合计** | **37** | **251** |

数据文件：`data/tasks.js`，结构如下（节选）：

```js
window.TASKS_DATA = {
  subjects: [
    {
      id: 'physiology',
      name: '生理',
      chapters: [
        {
          id: 'phy-ch2',
          name: '第二章 细胞的基本功能',
          page: 12,
          items: [
            { id: 'phy-ch2-1', name: '跨膜转运', page: 12, kind: 'section' },
            { id: 'phy-ch2-2', name: '跨膜转运与临床', page: 22, kind: 'plus' }
          ]
        }
      ]
    }
  ]
};
```

- `kind: 'section'` 小节；`kind: 'plus'` 串讲（目录中的"串·"）；`kind: 'chapter'` 无小节的整章；`kind: 'sub'` 细分知识点
- 新增/修改任务只需编辑本文件，`id` 必须全局唯一（完成记录按 `id` 保存）
- 学科展示顺序 = `subjects` 数组顺序
- 学习转盘的 30 份时长写在 `js/turntable/core.js` 的 `WHEEL` 常量里，需要调整直接改数组

---

## 三、Supabase 云同步设置（免登录 · 约 3 分钟）

不需要注册 / 登录账号，数据放在你自己的 Supabase 项目里。**看板和转盘共用这一套配置与同步码。**
前端直接用浏览器 `fetch` 调用 `load_board` / `save_board` 两个 RPC（不需要加载任何 CDN 脚本，网络不稳也不会影响页面打开）。

1. 打开 https://supabase.com 登录（用现有账号即可），点 **New project** 新建一个项目，等待初始化完成。
2. 在 **Project Settings → API** 找到并复制两个值：
   - `Project URL`，形如 `https://abcdefghijklmn.supabase.co`
   - `anon public` / `publishable` 密钥，形如 `eyJhbGciOi...` 或 `sb_publishable_...`
3. 打开 **SQL Editor**，新建查询，粘贴执行下面整段 SQL：

```sql
-- 1) 存放进度的表：一行 = 一个同步码
create table if not exists public.boards (
  code text primary key,
  progress jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) 表本身不对外开放，只允许通过下面的函数读写
alter table public.boards enable row level security;

-- 3) 读取某个同步码的进度
create or replace function public.load_board(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(progress, '[]'::jsonb) from boards where code = p_code;
$$;

-- 4) 保存某个同步码的进度（不存在就创建）
create or replace function public.save_board(p_code text, p_progress jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into boards (code, progress, updated_at)
  values (p_code, coalesce(p_progress, '[]'::jsonb), now())
  on conflict (code) do update
    set progress = excluded.progress,
        updated_at = now();
$$;

-- 5) 只允许匿名前端调用这两个函数
revoke all on function public.load_board(text) from public;
revoke all on function public.save_board(text, jsonb) from public;
grant execute on function public.load_board(text) to anon, authenticated;
grant execute on function public.save_board(text, jsonb) to anon, authenticated;
```

4. 把 URL 和 anon key 填进 `js/supabase-config.js`：

```js
window.SUPABASE_CONFIG = {
  url: 'https://你的项目编号.supabase.co',
  anonKey: '你的 anon public key'
};
```

5. 刷新页面，点顶栏的「**设置同步码**」→ 弹窗会自动填好一个随机码 → 点「**连接并同步**」即可。
   - 第一次会创建这个同步码对应的云端记录
   - 把同步码记下来（备忘录 / 截图都行；也可以点「生成随机码」换一个）
6. 在手机、另一台电脑上打开同一页面，填入**同一个同步码** → 连接，即可看到同一份看板与转盘记录。

存储方式（不需要额外建表）：

- 看板进度存在该同步码对应的行里（`progress` 为已完成任务 id 数组）
- 转盘记录存在同一张表、同一个同步码加后缀 `#turntable` 的行里（`progress` 为 `{ version, updatedAt, days }` 对象）
- 两者由前端自动区分，云端只多一行数据

使用说明：

- 之后每次勾选 / 抽签 / 打卡都会自动写回云端（约 0.6 秒防抖），顶栏显示「已同步」即写入成功
- 想立即拉取云端最新状态：点一下顶栏的同步状态按钮
- 「断开本机同步」只清除本机记住的码并清空当前页面显示，云端数据保留；重新填入同一个码即可恢复
- 也可以用分享链接的方式打开：`https://<你的站点>/?code=你的同步码`（打开后自动连接）

> 安全说明：`anon key` 设计上就是可以公开在前端的；数据库表默认拒绝匿名直接读写，只能通过
> `load_board` / `save_board` 两个函数按同步码访问，因此**同步码相当于密码**，请不要公开。
> 千万不要把 `service_role` 密钥写进前端。

---

## 四、本地预览

直接双击 `index.html` 即可查看（云同步需要联网加载 Supabase SDK；本地文件协议下功能同样可用）。

如果浏览器对本地 `file://` 有限制，建议用任意静态服务器预览：

```bash
# 在项目根目录执行
python -m http.server 8080
# 然后访问 http://localhost:8080
```

---

## 五、部署到 GitHub Pages

### 方式 A：Actions 自动部署（推荐，仓库里可以放讲义等大文件）

本仓库已包含 `.github/workflows/pages.yml`：推送 `main` 分支后自动把**站点文件**发布到 Pages（只打包 `index.html`、`css/`、`js/`、`data/`，不会把 PDF 讲义上传成网页资源）。

1. 在 GitHub 新建仓库并推送本项目
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
3. 推送 `main` 分支（或手动运行工作流），等待部署完成
4. 访问 `https://<用户名>.github.io/<仓库名>/`

### 方式 B：手动上传（最简单）

1. 新建仓库，只上传站点文件（保持目录结构）：
   - `index.html`
   - `css/style.css`
   - `css/turntable.css`
   - `js/app.js`
   - `js/cloud.js`
   - `js/supabase-config.js`
   - `js/turntable/core.js`
   - `js/turntable/wheel.js`
   - `js/turntable/charts.js`
   - `js/turntable/app.js`
   - `data/tasks.js`
   - `.nojekyll`（可选，防止 Jekyll 处理）
2. **Settings → Pages → Source** 选择 **Deploy from a branch**，分支选 `main`、目录选 `/ (root)`
3. 稍等片刻访问 `https://<用户名>.github.io/<仓库名>/`

> 注意：`js/supabase-config.js` 里只有可公开的 `anon key`，可以放心提交；
> 不要把 `讲义/`（约 600 MB 的 PDF）与 `目录/` 原图一起提交到 GitHub，网站运行不需要它们。

---

## 六、目录结构

```
.
├── index.html              # 页面结构（只含 UI：看板视图 + 转盘视图）
├── css/
│   ├── style.css           # 看板 / 顶栏 / 弹窗的蓝色简约风格
│   └── turntable.css       # 学习转盘视图样式（全部限定在 #wheelView 内）
├── js/
│   ├── app.js              # 看板交互 + 视图切换 + 云同步接线
│   ├── cloud.js            # 云同步：加载 Supabase SDK、按同步码读写看板与转盘
│   ├── supabase-config.js  # Supabase 项目 URL + anon key（需自行填写）
│   └── turntable/
│       ├── core.js         # 转盘纯逻辑：时长表、旋转落点、倒计时、日期与统计
│       ├── wheel.js        # 转盘 Canvas 绘制与缓动旋转
│       ├── charts.js       # 统计图表（环形图 / 柱状图 / PNG 导出）
│       └── app.js          # 转盘页面逻辑：抽签、任务栏、统计、导入导出、云同步
├── data/
│   └── tasks.js            # 看板全部任务数据（单独维护）
├── tests/
│   ├── dom_test.js         # 看板 + 视图切换 + 顶栏统计面板 + 云同步（61 项断言）
│   ├── turntable_core_test.js  # 转盘纯逻辑与页面结构（25 项断言）
│   └── turntable_app_test.js   # 转盘页面逻辑 + 云同步读写（Node DOM 模拟，25 项断言）
├── .github/workflows/
│   └── pages.yml           # GitHub Pages 自动部署
├── .nojekyll
├── 目录/                    # 五张任务目录原图（不参与部署）
├── 讲义/                    # 课程 PDF（不参与部署）
└── study-turntable/        # 原独立版学习转盘（仅作参考，不参与部署）
```

运行测试（可选，需要 Node.js）：

```bash
node tests/dom_test.js
node tests/turntable_core_test.js
node tests/turntable_app_test.js
```

三个测试文件合计 111 项断言，全部通过即可放心部署。

---

## 七、备份与恢复

- 云同步正常时进度在 Supabase 云端，多设备共享；但仍建议偶尔点「导出」留一份 JSON 备份
- 看板「导入」为合并模式，不会覆盖已有记录
- 看板「重置」会清空当前全部完成记录（已连接同步码时云端也会清空），操作前请确认
- 转盘的「导出数据 / 导入数据」作用于转盘记录；「清空全部数据」会清空转盘记录，不影响看板进度

---

## 八、后续可以继续扩展

- 在 `data/tasks.js` 中补充更多目录层级或新增学科
- 在 `js/turntable/core.js` 的 `WHEEL` 中调整抽签时长分布
- 需要更严格的权限时，可把同步码模式换成 Supabase Auth 账号登录（表结构已经是 RLS-ready）
- 可按周记录学习时长、错题复习等统计
