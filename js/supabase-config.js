/*
 * ============================================================
 *  Supabase 云同步配置（免登录 · 同步码模式）
 * ------------------------------------------------------------
 *  使用方法（详见 README「云同步设置」与页面里的配置指南）：
 *   1. 打开 https://supabase.com 登录，新建一个 Project；
 *   2. 在 Project Settings → API 里复制：
 *        - Project URL            → 填到下面的 url
 *        - anon / publishable key → 填到下面的 anonKey
 *   3. 在 SQL Editor 里执行 README 中的 SQL：
 *        建 public.boards 表（code + progress + updated_at），
 *        开启 RLS，并创建 load_board / save_board 两个函数；
 *   4. 刷新本页面，点顶栏「云同步」→「生成随机码」→「连接并同步」；
 *      换设备时填同一个同步码即可继续同步（看板与转盘共用这个同步码）。
 *
 *  说明：不需要注册账号、不需要邮箱密码；同步码就是数据钥匙。
 *        anon key 可以公开在前端使用（表默认拒绝匿名直读直写，只能通过
 *        load_board / save_board 按同步码访问），千万不要把 service_role
 *        密钥写进前端。同步码请当成密码保管，不要公开。
 * ============================================================
 */

window.SUPABASE_CONFIG = {
  url: 'https://ixzedyjpjmouswryjhwp.supabase.co',
  anonKey: 'sb_publishable_V0awaywz_GFHkSucKg-V-A_9orDga9s'
};
