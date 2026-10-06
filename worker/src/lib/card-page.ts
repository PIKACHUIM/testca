/**
 * `/card/web/cert` 的上传页面（服务端渲染，无外部依赖 / 无 CDN）。
 *
 * 等价于 TPMSmartCard 项目的 templates/CertUpload.html，但：
 *   - 直接提交到当前 Worker（相对路径，兼容 /card/* 与旧 /web/cert 两种前缀）
 *   - 增加拖拽选择、前端校验、结果提示、缓存状态查询
 *   - 配置 CARD_ADMIN_TOKEN 后额外显示缓存列表（可删除）
 */
export interface CardPageOptions {
  /** URL 上预填的传输密钥 */
  pubkey?: string;
  /** 是否启用管理面板（配置了 CARD_ADMIN_TOKEN） */
  adminEnabled?: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderCardUploadPage(opts: CardPageOptions = {}): string {
  const pubkey = escapeHtml(opts.pubkey ?? "");
  const adminSection = opts.adminEnabled ? ADMIN_SECTION : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>智能卡证书分发 · Pika Test CA</title>
<style>
:root{
  --bg:#070b17; --panel:rgba(255,255,255,.045); --line:rgba(255,255,255,.10);
  --txt:#e8ecf7; --dim:#9aa6c2; --accent:#ffd23f; --accent2:#4f8cff;
  --ok:#39d98a; --err:#ff6b6b; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:
    radial-gradient(1000px 600px at 12% -10%,rgba(79,140,255,.20),transparent 60%),
    radial-gradient(900px 520px at 92% 8%,rgba(255,210,63,.14),transparent 55%),
    var(--bg);
  color:var(--txt);
  font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  min-height:100vh;
}
.page{max-width:900px;margin:0 auto;padding:44px 20px 72px}
.hero__badge{
  display:inline-block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);border:1px solid rgba(255,210,63,.35);border-radius:999px;
  padding:3px 12px;background:rgba(255,210,63,.08)
}
.hero h1{margin:14px 0 8px;font-size:30px;letter-spacing:.5px}
.hero p{margin:0;color:var(--dim);max-width:70ch}
.steps{
  list-style:none;margin:26px 0;padding:0;display:grid;gap:10px;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr))
}
.steps li{
  background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;
  color:var(--dim);font-size:13.5px
}
.steps b{
  display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-right:8px;
  border-radius:50%;background:rgba(255,210,63,.16);color:var(--accent);font-size:12px
}
.card{
  background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;
  backdrop-filter:blur(6px);margin-bottom:18px
}
.field{display:block;margin-bottom:16px}
.field__label{display:block;margin-bottom:7px;font-size:13.5px;color:var(--txt)}
.field__label em{font-style:normal;color:var(--dim);font-size:12.5px}
input[type=text],input[type=password],textarea{
  width:100%;padding:11px 13px;border-radius:11px;border:1px solid var(--line);
  background:rgba(6,10,22,.72);color:var(--txt);font:14px/1.5 var(--mono);
  outline:none;transition:border-color .15s,box-shadow .15s
}
input[type=text]:focus,input[type=password]:focus,textarea:focus{
  border-color:rgba(79,140,255,.75);box-shadow:0 0 0 3px rgba(79,140,255,.16)
}
textarea{resize:vertical;word-break:break-all}
.row{display:flex;gap:16px;flex-wrap:wrap}
.row .grow{flex:1 1 240px;margin-bottom:16px}
.inline{display:flex;gap:8px;align-items:center}
.inline input{flex:1 1 auto}
.drop{
  border:1.5px dashed rgba(255,255,255,.22);border-radius:14px;padding:22px;text-align:center;
  cursor:pointer;transition:.18s;background:rgba(6,10,22,.45)
}
.drop:hover,.drop.is-over{border-color:var(--accent);background:rgba(255,210,63,.07)}
.drop__hint{color:var(--dim);font-size:13.5px}
.drop__name{margin-top:8px;font:13px var(--mono);color:var(--accent);word-break:break-all}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}
.btn{
  appearance:none;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--txt);
  padding:11px 20px;border-radius:11px;font-size:14px;cursor:pointer;transition:.16s
}
.btn:hover{background:rgba(255,255,255,.10)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn--primary{
  background:linear-gradient(135deg,var(--accent),#ffb43f);border-color:transparent;color:#241d00;font-weight:600
}
.btn--primary:hover{filter:brightness(1.06)}
.btn--danger{border-color:rgba(255,107,107,.4);color:var(--err)}
.result{margin-top:16px;border-radius:12px;padding:13px 15px;font-size:13.5px;border:1px solid}
.result.ok{border-color:rgba(57,217,138,.42);background:rgba(57,217,138,.10);color:#b8f5d3}
.result.err{border-color:rgba(255,107,107,.42);background:rgba(255,107,107,.10);color:#ffd0d0}
.result.info{border-color:var(--line);background:rgba(255,255,255,.04);color:var(--dim)}
.meta{margin-top:10px;font:12.5px var(--mono);color:var(--dim);word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--dim);font-weight:500;font-size:12.5px}
td.mono{font-family:var(--mono);font-size:12px;word-break:break-all}
.muted{color:var(--dim);font-size:12.5px}
footer{margin-top:26px;color:var(--dim);font-size:12.5px;text-align:center}
a{color:var(--accent2)}
</style>
</head>
<body>
<div class="page">
  <header class="hero">
    <div class="hero__badge">TPM Virtual Smart Card</div>
    <h1>智能卡证书分发</h1>
    <p>把 PKCS#12 证书安全下发给 TPM 虚拟智能卡：浏览器上传 → Worker 用 X25519 协商密钥并以 AES-256-CBC 加密 → 密文存入 KV → 智能卡工具凭“传输密钥”取回并在本机解密装入卡片。Worker 全程不保存共享密钥，KV 中只有密文。</p>
  </header>

  <ol class="steps">
    <li><b>1</b>在智能卡工具中选择「证书导入 / 云端下发」，工具会生成<b>传输密钥</b>并复制到剪贴板。</li>
    <li><b>2</b>把传输密钥粘贴到下方，选择 PFX 文件并填写其密码，点击「加密上传」。</li>
    <li><b>3</b>回到工具点击导入，工具自动取回、解密并写入 TPM 智能卡。</li>
  </ol>

  <form id="upload-form" class="card" autocomplete="off">
    <label class="field">
      <span class="field__label">传输密钥 <em>（客户端 X25519 公钥，Base64）</em></span>
      <textarea id="pubkey" name="pubkey" rows="2" spellcheck="false" required placeholder="粘贴智能卡工具生成的传输密钥">${pubkey}</textarea>
    </label>

    <div class="row">
      <label class="field grow">
        <span class="field__label">PFX 密码 <em>（导入卡片时使用）</em></span>
        <span class="inline">
          <input id="pfxkey" name="pfxkey" type="password" spellcheck="false" placeholder="证书文件密码" />
          <button type="button" class="btn" id="toggle-pw" style="padding:10px 14px">显示</button>
        </span>
      </label>
      <label class="field grow">
        <span class="field__label">备注 <em>（可选，仅本服务可见）</em></span>
        <input id="label" name="label" type="text" maxlength="64" spellcheck="false" placeholder="例如：张三 - 办公笔记本" />
      </label>
    </div>

    <label class="field">
      <span class="field__label">PFX / P12 文件</span>
      <div id="drop" class="drop">
        <input id="file" type="file" accept=".pfx,.p12,application/x-pkcs12" hidden />
        <div class="drop__hint">点击选择，或把 .pfx / .p12 文件拖拽到此处</div>
        <div id="fname" class="drop__name"></div>
      </div>
    </label>

    <div class="actions">
      <button type="submit" id="submit" class="btn btn--primary">加密上传</button>
      <button type="button" id="check" class="btn">检查缓存状态</button>
    </div>

    <div id="result" class="result" hidden></div>
  </form>
${adminSection}
  <footer>
    密文仅能由持有对应临时私钥的智能卡工具解开 · <span id="api-base" class="muted"></span>
  </footer>
</div>

<script>
(function () {
  // 页面同时挂载在 /card/web/cert 与旧路径 /web/cert 下，API 前缀按当前路径推导
  var API = location.pathname.replace(/\\/web\\/(cert|upload)\\/*$/, "");
  document.getElementById("api-base").textContent = API || "/";

  var $ = function (id) { return document.getElementById(id); };
  var result = $("result");
  var fileInput = $("file");
  var drop = $("drop");

  function show(kind, html) {
    result.hidden = false;
    result.className = "result " + kind;
    result.innerHTML = html;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KiB";
    return (n / 1048576).toFixed(2) + " MiB";
  }
  function fmtTime(s) {
    var d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString();
  }

  // ---- 文件选择 -----------------------------------------------------------
  drop.addEventListener("click", function () { fileInput.click(); });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
  });
  drop.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      onPick();
    }
  });
  fileInput.addEventListener("change", onPick);
  function onPick() {
    var f = fileInput.files && fileInput.files[0];
    $("fname").textContent = f ? f.name + "  (" + fmtBytes(f.size) + ")" : "";
  }

  // ---- 密码可见性 ---------------------------------------------------------
  $("toggle-pw").addEventListener("click", function () {
    var el = $("pfxkey");
    var hidden = el.type === "password";
    el.type = hidden ? "text" : "password";
    this.textContent = hidden ? "隐藏" : "显示";
  });

  // ---- 传输密钥预校验 -----------------------------------------------------
  function checkPubkey(pub) {
    if (!pub) return "请填写传输密钥";
    var s = pub.replace(/\\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    if (!/^[A-Za-z0-9+/]+$/.test(s)) return "传输密钥不是合法的 Base64 文本";
    var pad = (4 - (s.length % 4)) % 4;
    var b64 = s + new Array(pad + 1).join("=");
    var raw;
    try { raw = atob(b64); } catch (e) { return "传输密钥 Base64 解码失败"; }
    if (raw.length !== 32) return "传输密钥应为 32 字节（当前 " + raw.length + " 字节），请重新从工具复制";
    return null;
  }

  // ---- 上传 ---------------------------------------------------------------
  $("upload-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var pub = $("pubkey").value.trim();
    var bad = checkPubkey(pub);
    if (bad) { show("err", esc(bad)); return; }
    var f = fileInput.files && fileInput.files[0];
    if (!f) { show("err", "请选择 PFX / P12 文件"); return; }

    var fd = new FormData();
    fd.append("pubkey", pub);
    fd.append("pfxkey", $("pfxkey").value);
    fd.append("vaults", f, f.name);
    var label = $("label").value.trim();
    if (label) fd.append("label", label);

    var btn = $("submit");
    btn.disabled = true;
    show("info", "正在加密并写入 KV …");
    try {
      var res = await fetch(API + "/put/cert", { method: "POST", body: fd });
      var j = await res.json().catch(function () { return {}; });
      if (res.ok && j && j.flag) {
        var m = j.meta || {};
        show("ok",
          "<b>上传成功，密文已缓存。</b><br>请回到智能卡工具点击导入（通常 7 天内有效）。" +
          '<div class="meta">指纹 ' + esc(m.fingerprint || "") +
          "<br>大小 " + fmtBytes(m.size || f.size) +
          "<br>SHA-256 " + esc(m.sha256 || "") + "</div>");
      } else {
        show("err", "<b>上传失败：</b>" + esc((j && (j.text || j.message)) || ("HTTP " + res.status)));
      }
    } catch (err) {
      show("err", "<b>网络错误：</b>" + esc(err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
    }
  });

  // ---- 缓存状态查询 -------------------------------------------------------
  $("check").addEventListener("click", async function () {
    var pub = $("pubkey").value.trim();
    var bad = checkPubkey(pub);
    if (bad) { show("err", esc(bad)); return; }
    var body = new URLSearchParams();
    body.append("pubkey", pub);
    try {
      var res = await fetch(API + "/status", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      var j = await res.json().catch(function () { return {}; });
      if (j && j.flag && j.meta) {
        var m = j.meta;
        show("info",
          "<b>该传输密钥已有缓存记录</b>（重复上传会覆盖）。" +
          '<div class="meta">指纹 ' + esc(m.fingerprint || "") +
          "<br>大小 " + fmtBytes(m.size || 0) +
          "<br>创建 " + esc(fmtTime(m.createdAt || "")) +
          (m.label ? "<br>备注 " + esc(m.label) : "") + "</div>");
      } else {
        show("info", "该传输密钥当前没有缓存记录，可继续上传。");
      }
    } catch (err) {
      show("err", "<b>网络错误：</b>" + esc(err && err.message ? err.message : String(err)));
    }
  });
${ADMIN_SCRIPT}
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 管理面板（仅当配置 CARD_ADMIN_TOKEN 时渲染）
// ---------------------------------------------------------------------------

const ADMIN_SECTION = `
  <section class="card" id="admin">
    <span class="field__label">缓存管理 <em>（需要 CARD_ADMIN_TOKEN）</em></span>
    <div class="inline" style="margin-top:6px">
      <input id="token" type="password" placeholder="管理令牌" spellcheck="false" />
      <button type="button" class="btn" id="refresh">刷新列表</button>
    </div>
    <div id="admin-result" class="result" hidden></div>
    <div id="admin-table" style="margin-top:12px"></div>
    <p class="muted">令牌仅保存在本页内存中（localStorage 记忆开关默认关闭），不会写入 URL。</p>
    <div class="inline" style="margin-top:8px">
      <button type="button" class="btn" id="remember">记住令牌</button>
      <span class="muted">记住后下次打开本页自动填充（仅存本机浏览器）</span>
    </div>
  </section>`;

const ADMIN_SCRIPT = `
  // ---- 管理面板 -----------------------------------------------------------
  var adminResult = $("admin-result");
  function adminShow(kind, html) {
    adminResult.hidden = false;
    adminResult.className = "result " + kind;
    adminResult.innerHTML = html;
  }
  function token() { return ($("token").value || "").trim(); }

  try {
    var saved = localStorage.getItem("cardAdminToken");
    if (saved) $("token").value = saved;
  } catch (e) {}

  $("remember").addEventListener("click", function () {
    try {
      if (token()) { localStorage.setItem("cardAdminToken", token()); this.textContent = "已记住"; }
    } catch (e) {}
  });

  async function loadList() {
    if (!token()) { adminShow("err", "请先填写管理令牌"); return; }
    adminShow("info", "加载中 …");
    try {
      var res = await fetch(API + "/admin/list?token=" + encodeURIComponent(token()));
      var j = await res.json().catch(function () { return {}; });
      if (!res.ok || !j || !j.flag) {
        adminShow("err", esc((j && (j.text || j.message)) || ("HTTP " + res.status)));
        return;
      }
      var rows = (j.data && j.data.items) || [];
      if (!rows.length) { adminShow("info", "KV 中暂无分发记录"); $("admin-table").innerHTML = ""; return; }
      adminShow("info", "共 " + rows.length + " 条记录，过期时间由 CARD_TTL_SECONDS 控制。");
      var html = "<table><thead><tr><th>指纹</th><th>备注</th><th>大小</th><th>创建时间</th><th></th></tr></thead><tbody>";
      rows.forEach(function (it) {
        html += "<tr><td class='mono'>" + esc((it.fingerprint || "").slice(0, 16)) + "…</td>" +
          "<td>" + esc(it.label || "-") + "</td>" +
          "<td class='mono'>" + fmtBytes(it.size || 0) + "</td>" +
          "<td class='mono'>" + esc(fmtTime(it.createdAt || "")) + "</td>" +
          "<td><button type='button' class='btn btn--danger' data-del='" + esc(it.fingerprint) + "'>删除</button></td></tr>";
      });
      html += "</tbody></table>";
      $("admin-table").innerHTML = html;
      Array.prototype.forEach.call($("admin-table").querySelectorAll("[data-del]"), function (b) {
        b.addEventListener("click", async function () {
          var fp = b.getAttribute("data-del");
          if (!confirm("确认删除该缓存记录？删除后智能卡工具将无法再取回。")) return;
          var body = new URLSearchParams();
          body.append("fingerprint", fp);
          var res = await fetch(API + "/admin/delete", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", "x-admin-token": token() },
            body: body.toString(),
          });
          var j = await res.json().catch(function () { return {}; });
          adminShow(j && j.flag ? "ok" : "err", esc((j && (j.text || j.message)) || ("HTTP " + res.status)));
          loadList();
        });
      });
    } catch (err) {
      adminShow("err", "网络错误：" + esc(err && err.message ? err.message : String(err)));
    }
  }
  $("refresh").addEventListener("click", loadList);
`;
