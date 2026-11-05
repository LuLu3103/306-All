# 西综学习台（进度看板 + 学习转盘 + 讲义阅读）

一个蓝色简约风格的静态学习网站，把三件事合在同一个站点里：

1. **进度看板**：跟踪医学五大学科（生理、病理、内科、外科、生化）讲义任务的完成情况
2. **学习转盘**：抽签决定今天的学习时长，带倒计时、任务栏与时长统计
3. **讲义阅读**：在进度看板点任意任务的蓝色页码 `Pxx`，直接打开对应讲义页并定位；也可以从顶栏「讲义」进入阅读器

- 学科顺序固定：**生理 · 病理 · 内科 · 外科 · 生化**（看板与讲义阅读器顺序一致）
- 顶栏一键切换「进度看板 / 学习转盘」，不用跳转页面，地址栏 `#wheel` 直达转盘；顶栏「讲义」在新标签页打开讲义阅读器
- 纯静态站点（HTML + CSS + 原生 JavaScript + pdf.js），无需自己的后端，可直接托管在 GitHub Pages
- 任务数据单独放在 `data/tasks.js`，`index.html` 只保留界面结构
- 两个功能共用**同一个免登录同步码**，进度都保存在 Supabase 云端，换设备填同一个码即可继续

---

## 一、功能结构

顶栏统一为：品牌「西综讲义进度看板」+ 视图切换（进度看板 / 学习转盘）+ 五个学科按钮（生理-病理-内科-外科-生化）+ 统计按钮（下拉可收起）+ 外链按钮（**讲义**、ttsx每日计划、ttsx口诀/题库、GitHub 仓库）+ 使用说明 + 云同步状态 + 导出 / 导入 / 重置。

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
- `GitHub` → https://github.com/LuLu3103/306-All

顶栏「使用说明」：打开网站说明书，分「进度看板 / 学习转盘 / 云同步」三个标签页；转盘页工具栏里也有转盘的详细说明。

### 3. 讲义阅读

从进度看板或顶栏进入 `讲义/` 阅读器（独立页面，新标签页打开）：

- **5 个科目**与看板完全对应：生理、病理、内科、外科、生化
- **页码深链**：页面上每个任务的蓝色页码 `Pxx` 都是链接，指向
  `讲义/index.html#s=<科目id>&md=<讲义页码>`，打开后自动切到对应科目、对应分册，并滚动定位到那一页
- **分册**：外科分「上册 / 下册」；生理为满足 GitHub 单文件 100MB 限制拆成「上册 / 下册」两本（内容连续、页码不变）。选中这两科时科目按钮下方会出现分册切换，目录条目右侧标「上·PDF x / 下·PDF x」
- **目录**：左侧列出全部章节与小节，绿色 `p.41` 是与看板一致的讲义页码，灰色 `PDF 41` 是 PDF 实际页序；点击条目直接跳转
- **阅读器功能**：上一页 / 下一页、PDF 页码跳转、缩放、打开原始 PDF、记住每科（每分册）上次阅读位置、返回看板按钮
- 快捷键：`← / →` 翻页，`[ / ]` 切换科目，`Home / End` 跳当前分册首末页

> 看板任务在 `data/tasks.js` 里的 `page` 字段就是讲义页码，与阅读器 `data/toc-data.js` 的 `page` 同源；
> 两者页码一致时，点 `Pxx` 才能跳准。极少数条目原本没有 PDF 书签，阅读器按相邻条目推算（误差通常 1~3 页）。

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
- **忘了同步码**：点顶栏「同步码」按钮可查看 / 复制当前设备保存的码；若换过设备或清过浏览器缓存，
  请到之前连接过的设备查看，或在 Supabase SQL Editor 执行 `select code from public.boards;`
  找回（`#turntable` 结尾的行是转盘记录，取前面的部分就是同步码）

> 安全说明：`anon key` 设计上就是可以公开在前端的；数据库表默认拒绝匿名直接读写，只能通过
> `load_board` / `save_board` 两个函数按同步码访问，因此**同步码相当于密码**，请不要公开。
> 千万不要把 `service_role` 密钥写进前端。

---

## 四、本地预览

看板本身双击 `index.html` 也能看，但**讲义阅读器必须通过 http:// 访问**（浏览器在 `file://` 下不允许读取本地 PDF）。
所以推荐直接双击根目录的 **`启动网站.cmd`**：它会启动本地服务器（`serve.py`，端口 8787）并自动打开浏览器：

```
http://127.0.0.1:8787/
```

手动启动也可以（在项目根目录执行）：

```bash
python serve.py 8787
# 然后访问 http://127.0.0.1:8787/
```

- 首次打开先看到进度看板，点任意任务右侧的蓝色 `Pxx` 页码即可进入讲义对应页
- 端口被占用时：换一个端口（如 `python serve.py 8080`），并把 `启动网站.cmd` 里的地址一起改掉
- 不想用命令行的话，`启动网站.cmd` 双击即可；关闭那个黑色窗口就停止服务器

---

## 五、部署到 GitHub Pages

讲义阅读器整合进站点后，`讲义/` 也要一起部署，线上点页码才能看到 PDF。

### 体积说明（重要）

| 项目 | 大小 |
| --- | --- |
| 看板 + 转盘代码 | < 1 MB |
| `讲义/assets/` 7 个 PDF 分册 | 约 370 MB |

- GitHub **单个文件上限 100MB**：生理原始单本 146MB、外科上/下 129/132MB，所以已拆成
  `physiology-1/2.pdf`、`surgery1/2.pdf`（外科仍分上/下两册，生理拆成上/下两册），
  现在 7 个分册都小于 100MB，可以直接提交
- 原始整本 PDF 放在 `讲义/assets-original/`，**已在 `.gitignore` 中排除**，不参与部署；只在本地保留
- GitHub Pages 站点总量上限 1GB，本站约 370MB，余量充足
- 首次推送约 370MB，会慢一些；之后只推送改动的文件

### 方式 A：Actions 自动部署（推荐）

仓库里的 `.github/workflows/pages.yml` 会在推送 `main` 后自动打包 `index.html`、`css/`、`js/`、`data/`、`讲义/` 并发布：

1. 在 GitHub 新建仓库并推送本项目（**用 GitHub Desktop 或 git 命令**；网页上传单文件上限 25MB，无法上传 PDF）
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
3. 推送 `main` 分支（或手动运行工作流），等待部署完成
4. 访问 `https://<用户名>.github.io/<仓库名>/`，点看板页码即可打开线上讲义页

工作流会额外打印 `讲义/assets` 的体积，并检查有没有超过 95MB 的文件，方便提前发现 GitHub 限制问题。

### 方式 B：手动上传（只适合不带 PDF 的轻量版）

网页上传不支持大文件，所以只上传站点代码：

1. 新建仓库，只上传站点文件（保持目录结构）：
   - `index.html`、`css/`、`js/`、`data/`、`.nojekyll`
2. **Settings → Pages → Source** 选择 **Deploy from a branch**，分支选 `main`、目录选 `/ (root)`
3. 访问 `https://<用户名>.github.io/<仓库名>/`（看板功能完整，但点页码会提示讲义 PDF 未部署）

### 更新讲义的流程

- **只换 PDF 内容、章节和页数不变**：把新的 PDF 分册直接覆盖 `讲义/assets/` 里对应文件即可
  （生理两册分别覆盖 `physiology-1.pdf`、`physiology-2.pdf`；外科 `surgery1.pdf` = 上册、`surgery2.pdf` = 下册）。
  改完双击 `启动网站.cmd` 在本地翻几页确认，再推送 GitHub。
- **章节或页码有变化**：需要同步重建 `讲义/data/toc-data.js` 的页码映射。
  重建脚本在本机工作区的 `web/tools/` 里（`build_toc_all.py`、`split_pdfs.py`、`repair_surgery_toc.py`），
  不是日常操作；改动前先把 `data/toc-data.js` 备份一份。

> 注意：`js/supabase-config.js` 里只有可公开的 `anon key`，可以放心提交；
> **不要**把 `目录/` 原图、`讲义/assets-original/` 原始整本 PDF 提交到 GitHub。

---

## 六、目录结构

```
.
├── index.html              # 页面结构（只含 UI：看板视图 + 转盘视图）
├── css/
│   ├── style.css           # 看板 / 顶栏 / 弹窗的蓝色简约风格
│   └── turntable.css       # 学习转盘视图样式（全部限定在 #wheelView 内）
├── js/
│   ├── app.js              # 看板交互 + 视图切换 + 云同步接线 + 页码深链接
│   ├── cloud.js            # 云同步：加载 Supabase SDK、按同步码读写看板与转盘
│   ├── supabase-config.js  # Supabase 项目 URL + anon key（需自行填写）
│   └── turntable/
│       ├── core.js         # 转盘纯逻辑：时长表、旋转落点、倒计时、日期与统计
│       ├── wheel.js        # 转盘 Canvas 绘制与缓动旋转
│       ├── charts.js       # 统计图表（环形图 / 柱状图 / PNG 导出）
│       └── app.js          # 转盘页面逻辑：抽签、任务栏、统计、导入导出、云同步
├── data/
│   └── tasks.js            # 看板全部任务数据（含讲义页码 page 字段）
├── 讲义/                    # 讲义阅读器（线上也部署）
│   ├── index.html          # 阅读器页面
│   ├── css/style.css       # 阅读器样式
│   ├── js/app.js           # 阅读器逻辑：目录跳转、按需渲染、分册切换、深链
│   ├── data/toc-data.js    # 目录 + 讲义页码 ↔ PDF 页码映射（生理/外科各两册）
│   ├── assets/*.pdf        # 7 个 PDF 分册（全部 < 100MB）
│   ├── assets-original/    # 原始整本 PDF 备份（.gitignore 排除，不部署）
│   ├── vendor/pdfjs/       # pdf.js 4.4.168 渲染引擎
│   └── README.txt          # 阅读器使用说明
├── tests/
│   ├── dom_test.js         # 看板 + 视图切换 + 说明 + 统计 + 同步码 + 页码深链（83 项断言）
│   ├── turntable_core_test.js  # 转盘纯逻辑与页面结构（25 项断言）
│   └── turntable_app_test.js   # 转盘页面逻辑 + 云同步读写（Node DOM 模拟，25 项断言）
├── serve.py                # 本地静态服务器（支持 Range，供 pdf.js 分段读取）
├── 启动网站.cmd            # 双击启动本地预览（端口 8787）
├── .github/workflows/
│   └── pages.yml           # GitHub Pages 自动部署（含讲义）
├── .gitignore              # 排除 assets-original、目录原图与本地缓存
├── .nojekyll
├── 目录/                    # 五张任务目录原图（不参与部署）
└── study-turntable/        # 原独立版学习转盘（仅作参考，不参与部署）
```

运行测试（可选，需要 Node.js）：

```bash
node tests/dom_test.js
node tests/turntable_core_test.js
node tests/turntable_app_test.js
```

三个测试文件合计 133 项断言，全部通过即可放心部署。

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
