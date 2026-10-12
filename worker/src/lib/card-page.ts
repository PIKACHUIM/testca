/**
 * `/card/web/cert` 的上传页面（服务端渲染，无外部依赖 / 无 CDN）。
 *
 * 等价于 TPMSmartCard 项目的 templates/CertUpload.html，但：
 *   - 直接提交到当前 Worker（相对路径，兼容 /card/* 与旧 /web/cert 两种前缀）
 *   - 支持两种下发方式：传输密钥（X25519 预协商）与取件码（自协商）
 *   - 增加拖拽选择、前端校验、结果提示、缓存状态查询
 *   - 配置 CARD_ADMIN_TOKEN 后额外显示缓存列表（可删除）
 */
export interface CardPageOptions {
  /** URL 上预填的传输密钥 */
  pubkey?: string;
  /** 是否启用管理面板（配置了 CARD_ADMIN_PASSWORD 或 CARD_ADMIN_TOKEN） */
  adminEnabled?: boolean;
  /** 是否启用口令登录（配置了 CARD_ADMIN_PASSWORD） */
  passwordLogin?: boolean;
  /** 是否可用静态令牌（配置了 CARD_ADMIN_TOKEN） */
  tokenLogin?: boolean;
  /** 是否允许未登录下发（`CARD_ALLOW_ANONYMOUS`，默认 true） */
  allowAnonymous?: boolean;
  /** 默认模式：`key` = 传输密钥；`code` = 取件码。缺省按是否预填 pubkey 推断 */
  mode?: "key" | "code";
  /** 取件码模式默认有效期（秒，0 = 永不过期），用于预填下拉框 */
  defaultTtlSeconds?: number;
  /** 取件码模式默认下发次数，用于预填输入框 */
  defaultMaxUses?: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 取件码有效期下拉选项（秒 → 文案） */
const TTL_CHOICES: Array<{ value: number; label: string }> = [
  { value: 3600, label: "1 小时" },
  { value: 21600, label: "6 小时" },
  { value: 86400, label: "24 小时" },
  { value: 259200, label: "3 天" },
  { value: 604800, label: "7 天" },
  { value: 2592000, label: "30 天" },
  { value: 0, label: "永久有效" },
];

function renderTtlOptions(selected: number): string {
  const list = [...TTL_CHOICES];
  if (!list.some((o) => o.value === selected)) {
    list.push({ value: selected, label: `自定义（${selected} 秒）` });
  }
  return list
    .map(
      (o) =>
        `<option value="${o.value}"${o.value === selected ? " selected" : ""}>${o.label}</option>`,
    )
    .join("");
}

export function renderCardUploadPage(opts: CardPageOptions = {}): string {
  const pubkey = escapeHtml(opts.pubkey ?? "");
  const adminSection = opts.adminEnabled ? ADMIN_SECTION : "";
  // 供两段模板共用（ADMIN_SCRIPT 内以 \${...} 形式延迟到本层求值）
  const adminEnabled = !!opts.adminEnabled;
  const allowAnonymous = opts.allowAnonymous !== false;
  const defaultMode = opts.mode ?? (pubkey ? "key" : "code");
  const ttlOptions = renderTtlOptions(opts.defaultTtlSeconds ?? 86400);
  const defaultMaxUses = Math.min(Math.max(opts.defaultMaxUses ?? 1, 1), 100);
  // 关闭匿名下发时先由服务端隐藏表单（无 JS 环境同样生效），登录后由脚本放开
  const authNotice = allowAnonymous
    ? ""
    : adminEnabled
      ? '<div id="auth-notice" class="result err">本站已关闭匿名下发：请先在页面下方<b>管理员登录</b>后再上传证书。<br>取件码 / 传输密钥的取回不受影响。</div>'
      : '<div id="auth-notice" class="result err">本站已关闭匿名下发，且未配置管理员凭据（CARD_ADMIN_PASSWORD），请联系管理员。</div>';
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
input[type=text],input[type=password],input[type=number],select,textarea{
  width:100%;padding:11px 13px;border-radius:11px;border:1px solid var(--line);
  background:rgba(6,10,22,.72);color:var(--txt);font:14px/1.5 var(--mono);
  outline:none;transition:border-color .15s,box-shadow .15s
}
input[type=text]:focus,input[type=password]:focus,input[type=number]:focus,select:focus,textarea:focus{
  border-color:rgba(79,140,255,.75);box-shadow:0 0 0 3px rgba(79,140,255,.16)
}
textarea{resize:vertical;word-break:break-all}
select{font-family:inherit;cursor:pointer}
.seg{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 18px}
.seg label{
  display:flex;gap:9px;align-items:flex-start;flex:1 1 280px;cursor:pointer;
  border:1px solid var(--line);border-radius:12px;padding:12px 14px;
  background:rgba(6,10,22,.45);font-size:13.5px;transition:.16s
}
.seg label:hover{background:rgba(255,255,255,.06)}
.seg label.is-on{border-color:rgba(255,210,63,.55);background:rgba(255,210,63,.09)}
.seg input{margin:2px 0 0}
.seg em{display:block;font-style:normal;color:var(--dim);font-size:12.5px;margin-top:3px;line-height:1.55}
.code-out{
  font:26px/1.4 var(--mono);letter-spacing:3px;color:var(--accent);text-align:center;
  background:rgba(255,210,63,.10);border:1px dashed rgba(255,210,63,.45);
  border-radius:12px;padding:14px 12px;margin:12px 0;word-break:break-all
}
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
    <p>把 PKCS#12 证书安全下发给 TPM 虚拟智能卡，两种方式任选：<b>取件码（自协商）</b>——上传后平台生成带有效期与下发次数的口令，工具端只需填写口令即可取回，无需事先交换密钥；<b>传输密钥</b>——工具先生成 X25519 公钥，平台协商后以 AES-256-CBC 加密。两种方式下 Worker 都不保存明文口令 / 共享密钥，KV 中只有密文。</p>
  </header>

  <ol class="steps">
    <li><b>1</b>选择下发方式：<b>取件码（自协商）</b>无需事先交换密钥，上传后由平台生成口令；<b>传输密钥</b>则需先在工具中生成密钥。</li>
    <li><b>2</b>选择 PFX 文件并填写其密码（取件码模式另可设置有效期与下发次数），点击「加密上传」。</li>
    <li><b>3</b>把取件码（或传输密钥）交给用户，工具中填写后即可取回、解密并写入 TPM 智能卡。</li>
  </ol>

  ${authNotice}

  <form id="upload-form" class="card" autocomplete="off"${allowAnonymous ? "" : " hidden"}>
    <span class="field__label">下发方式</span>
    <div class="seg" id="mode-seg">
      <label id="seg-code">
        <input type="radio" name="mode" value="code" />
        <span>取件码（自协商）<em>上传后平台生成一次性口令，工具端只需填写口令即可取回；可设置有效期与下发次数，平台不保存明文口令</em></span>
      </label>
      <label id="seg-key">
        <input type="radio" name="mode" value="key" />
        <span>传输密钥（X25519）<em>先在智能卡工具中生成传输密钥并粘贴到下方，端到端加密，需与工具配对使用</em></span>
      </label>
    </div>

    <div id="block-key" hidden>
      <label class="field">
        <span class="field__label">传输密钥 <em>（客户端 X25519 公钥，Base64）</em></span>
        <textarea id="pubkey" name="pubkey" rows="2" spellcheck="false" placeholder="粘贴智能卡工具生成的传输密钥">${pubkey}</textarea>
      </label>
    </div>

    <div id="block-code" hidden>
      <div class="row">
        <label class="field grow">
          <span class="field__label">有效期 <em>（到期后自动失效）</em></span>
          <select id="ttl" name="ttl">${ttlOptions}</select>
        </label>
        <label class="field grow">
          <span class="field__label">下发次数 <em>（取回该次数后自动失效，默认 1）</em></span>
          <input id="max_uses" name="max_uses" type="number" min="1" max="100" value="${defaultMaxUses}" />
        </label>
      </div>
      <label class="field">
        <span class="field__label">取件码 <em>（留空 = 上传后由平台自动生成；也可自定义或一键随机）</em></span>
        <div class="inline">
          <input id="pickup_code" type="text" spellcheck="false" autocomplete="off"
                 placeholder="留空自动生成，或在此填写 / 点右侧一键随机" />
          <button type="button" class="btn" id="gen_code">一键随机</button>
          <button type="button" class="btn" id="copy_code" disabled>复制</button>
        </div>
        <div id="code_preview" class="meta"></div>
      </label>

      <label class="field">
        <span class="field__label">查询已有取件码 <em>（可选，仅查询剩余次数与有效期）</em></span>
        <input id="check_code" type="text" spellcheck="false" placeholder="例如 ABCD-EFGH-JKMN-PQRS" />
      </label>
    </div>

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
    取件码模式密文仅能由持有取件码的客户端解开 · 传输密钥模式密文仅能由持有临时私钥的工具解开 · <span id="api-base" class="muted"></span>
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

  // ---- 下发方式（传输密钥 / 取件码）切换 ----------------------------------
  var MODE = "${defaultMode}";
  var radios = document.querySelectorAll("#mode-seg input[name=mode]");

  function setMode(m) {
    MODE = m;
    $("block-key").hidden = m !== "key";
    $("block-code").hidden = m !== "code";
    $("seg-key").className = m === "key" ? "is-on" : "";
    $("seg-code").className = m === "code" ? "is-on" : "";
    Array.prototype.forEach.call(radios, function (r) { r.checked = r.value === m; });
    $("submit").textContent = m === "code" ? "加密上传并生成取件码" : "加密上传";
  }
  Array.prototype.forEach.call(radios, function (r) {
    r.addEventListener("change", function () { setMode(r.value); });
  });
  setMode(MODE);

  // ---- 取件码：留空自动生成 / 自定义（一键随机 + 即时预览 + 复制）--------
  // 规则与 worker/src/lib/card-code.ts 完全一致：33 字符字母表（无 I/L/O），
  // 16 位；自定义码至少需要 8 个不同字符（否则服务端会拒绝）。
  var CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ";
  var CODE_LEN = 16;
  var CODE_MIN_DISTINCT = 8;
  var codeInput = $("pickup_code");
  var codePreview = $("code_preview");
  var codeCopyBtn = $("copy_code");

  function normCode(s) {
    return String(s || "").toUpperCase().replace(/[^0-9A-Z]+/g, "")
      .replace(/O/g, "0").replace(/[IL]/g, "1");
  }
  function fmtCode(s) {
    var parts = s.match(new RegExp(".{1," + 4 + "}", "g"));
    return parts ? parts.join("-") : "";
  }
  function distinctCount(s) {
    var seen = {}, n = 0;
    for (var i = 0; i < s.length; i++) { if (!seen[s[i]]) { seen[s[i]] = 1; n++; } }
    return n;
  }
  function genCode() {
    var limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
    var out = "";
    while (out.length < CODE_LEN) {
      var bytes = new Uint8Array(CODE_LEN);
      crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length && out.length < CODE_LEN; i++) {
        if (bytes[i] < limit) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      }
    }
    return out;
  }
  function customCodeState() {
    var raw = normCode(codeInput.value);
    var distinct = distinctCount(raw);
    return {
      raw: raw,
      distinct: distinct,
      ok: raw.length === CODE_LEN && distinct >= CODE_MIN_DISTINCT,
    };
  }
  function refreshCode() {
    if (codeInput.value !== normCode(codeInput.value)) codeInput.value = normCode(codeInput.value);
    var st = customCodeState();
    codeCopyBtn.disabled = !st.ok;
    codeCopyBtn.textContent = "复制";
    if (!st.raw) {
      codePreview.innerHTML = "留空则由平台在上传时自动生成（仅显示一次）。";
      return;
    }
    if (st.ok) {
      codePreview.innerHTML = "取件码预览：<b>" + esc(fmtCode(st.raw)) + "</b>（16 位 · 不同字符 " +
        st.distinct + "）";
    } else {
      codePreview.innerHTML = "<span style='color:var(--danger,#ff7875)'>需要 16 位且至少 " +
        CODE_MIN_DISTINCT + " 个不同字符（当前 " + st.raw.length + " 位 · 不同字符 " + st.distinct + "）</span>";
    }
  }
  codeInput.addEventListener("input", refreshCode);
  $("gen_code").addEventListener("click", function () {
    codeInput.value = genCode();
    refreshCode();
  });
  codeCopyBtn.addEventListener("click", function () {
    var st = customCodeState();
    try {
      navigator.clipboard.writeText(fmtCode(st.raw));
      codeCopyBtn.textContent = "已复制";
    } catch (err) {
      codeCopyBtn.textContent = "请手动复制";
    }
  });
  refreshCode();

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
    var f = fileInput.files && fileInput.files[0];
    if (!f) { show("err", "请选择 PFX / P12 文件"); return; }

    var fd = new FormData();
    fd.append("pfxkey", $("pfxkey").value);
    fd.append("vaults", f, f.name);
    var label = $("label").value.trim();
    if (label) fd.append("label", label);
    // 站点关闭匿名下发时，把登录凭证一并带上（服务端会校验）
    if (typeof credential !== "undefined" && credential) fd.append("admin_token", credential);

    if (MODE === "key") {
      var pub = $("pubkey").value.trim();
      var bad = checkPubkey(pub);
      if (bad) { show("err", esc(bad)); return; }
      fd.append("pubkey", pub);
    } else {
      var ttl = parseInt($("ttl").value, 10);
      var uses = parseInt($("max_uses").value, 10);
      fd.append("mode", "code");
      fd.append("ttl", String(isNaN(ttl) ? 86400 : ttl));
      fd.append("max_uses", String(Math.min(Math.max(isNaN(uses) ? 1 : uses, 1), 100)));
      // 取件码：留空 = 由平台自动生成；否则必须通过格式与强度校验
      var customCode = customCodeState();
      if (customCode.raw.length > 0) {
        if (!customCode.ok) {
          show("err", "<b>取件码不可用：</b>需要 16 位且至少 " + CODE_MIN_DISTINCT +
            " 个不同字符（当前 " + customCode.raw.length + " 位 · 不同字符 " + customCode.distinct +
            "）；也可以清空该输入框让平台自动生成。");
          return;
        }
        fd.append("code", customCode.raw);
      }
    }

    var btn = $("submit");
    btn.disabled = true;
    show("info", "正在加密并写入 KV …");
    try {
      var res = await fetch(API + "/put/cert", { method: "POST", body: fd });
      var j = await res.json().catch(function () { return {}; });
      if (res.ok && j && j.flag) {
        var m = j.meta || {};
        var info = '<div class="meta">指纹 ' + esc(m.fingerprint || "") +
          "<br>大小 " + fmtBytes(m.size || f.size) +
          "<br>SHA-256 " + esc(m.sha256 || "") + "</div>";
        if (MODE === "code" && j.data && j.data.code) {
          show("ok",
            "<b>上传成功，取件码已就绪。</b><br>请把下方取件码交给用户，在智能卡工具的「云端下发 → 使用密码下发」中填写即可（本平台不保存明文口令）。" +
            '<div class="code-out">' + esc(j.data.code) + "</div>" +
            '<div class="actions" style="justify-content:center"><button type="button" class="btn" id="copy-code">复制取件码</button></div>' +
            '<div class="meta">有效期 ' + esc(j.data.expiresAt ? fmtTime(j.data.expiresAt) : "永久") +
            " · 下发次数 " + esc(j.data.maxUses) + " 次" +
            "<br>取件码仅本次显示，请立即复制并转交用户。" + info.replace('<div class="meta">', "<br>") + "</div>");
          var copyBtn = $("copy-code");
          if (copyBtn) {
            copyBtn.addEventListener("click", function () {
              try {
                navigator.clipboard.writeText(j.data.code);
                copyBtn.textContent = "已复制";
              } catch (err) {
                copyBtn.textContent = "请手动复制";
              }
            });
          }
        } else {
          show("ok",
            "<b>上传成功，密文已缓存。</b><br>请回到智能卡工具点击导入（通常 7 天内有效）。" + info);
        }
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
    var body = new URLSearchParams();
    if (typeof credential !== "undefined" && credential) body.append("admin_token", credential);
    if (MODE === "code") {
      var code = ($("check_code").value || "").trim();
      if (!code) { show("err", "请先填写要查询的取件码"); return; }
      body.append("code", code);
    } else {
      var pub = $("pubkey").value.trim();
      var bad = checkPubkey(pub);
      if (bad) { show("err", esc(bad)); return; }
      body.append("pubkey", pub);
    }
    try {
      var res = await fetch(API + "/status", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      var j = await res.json().catch(function () { return {}; });
      if (j && j.flag && j.meta) {
        var m = j.meta;
        var extra = m.mode === "code"
          ? "<br>剩余 " + esc(m.remaining) + " / " + esc(m.maxUses) + " 次" +
            "<br>有效期 " + esc(m.expiresAt ? fmtTime(m.expiresAt) : "永久")
          : "";
        show("info",
          "<b>该" + (m.mode === "code" ? "取件码" : "传输密钥") + "已有缓存记录</b>（重复上传会覆盖）。" +
          '<div class="meta">指纹 ' + esc(m.fingerprint || "") +
          "<br>大小 " + fmtBytes(m.size || 0) +
          "<br>创建 " + esc(fmtTime(m.createdAt || "")) +
          extra +
          (m.label ? "<br>备注 " + esc(m.label) : "") + "</div>");
      } else {
        show("info", "当前没有对应的缓存记录（取件码可能已过期 / 已用尽），可继续上传。");
      }
    } catch (err) {
      show("err", "<b>网络错误：</b>" + esc(err && err.message ? err.message : String(err)));
    }
  });
${adminEnabled ? adminScript({ adminEnabled, allowAnonymous }) : ""}
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
    <span class="field__label">缓存管理 <em id="admin-auth-state">（未登录）</em></span>
    <div id="admin-login-box">
      <div class="inline" style="margin-top:6px">
        <input id="password" type="password" placeholder="管理员口令（或管理令牌）" spellcheck="false" />
        <button type="button" class="btn" id="login">登录</button>
      </div>
      <p class="muted">口令登录只用于换取短期会话令牌，不会以明文形式保存在本页。</p>
      <div class="inline" style="margin-top:8px">
        <button type="button" class="btn" id="remember">记住令牌</button>
        <span class="muted">记住后下次打开本页自动登录（仅存本机浏览器）</span>
      </div>
    </div>
    <div id="admin-panel" hidden>
      <div class="inline" style="margin-top:6px">
        <button type="button" class="btn" id="refresh">刷新列表</button>
        <button type="button" class="btn btn--danger" id="logout">退出登录</button>
      </div>
      <div id="admin-result" class="result" hidden></div>
      <div id="admin-table" style="margin-top:12px"></div>
    </div>
  </section>`;

function adminScript(opts: {
  adminEnabled: boolean;
  allowAnonymous: boolean;
}): string {
  return `
  // ---- 管理员登录与记录管理 -----------------------------------------------
  var adminResult = $("admin-result");
  var ADMIN_ON = ${opts.adminEnabled ? "true" : "false"};
  var ALLOW_ANON = ${opts.allowAnonymous ? "true" : "false"};
  var CRED_KEY = "cardAdminCredential";

  function adminShow(kind, html) {
    adminResult.hidden = false;
    adminResult.className = "result " + kind;
    adminResult.innerHTML = html;
  }
  function adminHeaders() {
    return credential ? { "x-admin-token": credential } : {};
  }
  function setCredential(v) {
    credential = (v || "").trim();
    $("admin-panel").hidden = !credential;
    $("admin-login-box").hidden = !!credential;
    $("admin-auth-state").textContent = credential ? "（已登录）" : "（未登录）";
    applyAuthGate();
  }
  function applyAuthGate() {
    var needLogin = !ALLOW_ANON && !credential;
    $("upload-form").hidden = needLogin;
    var box = $("auth-notice");
    if (!box) return;
    box.hidden = !needLogin;
    if (needLogin) {
      box.innerHTML = ADMIN_ON
        ? "本站已关闭匿名下发：请先在页面下方<b>管理员登录</b>后再上传证书。<br>取件码 / 传输密钥的取回不受影响。"
        : "本站已关闭匿名下发，且未配置管理员凭据，请联系管理员配置 CARD_ADMIN_PASSWORD。";
    }
  }

  var credential = "";
  try {
    var saved = localStorage.getItem(CRED_KEY);
    if (saved) credential = saved;
  } catch (e) {}

  async function sessionInfo() {
    var res = await fetch(API + "/admin/session", { headers: adminHeaders() });
    return await res.json().catch(function () { return {}; });
  }
  async function verifyCredential() {
    var j = await sessionInfo();
    return !!(j && j.data && j.data.authenticated) ? j.data : null;
  }

  async function doLogin() {
    var pwd = ($("password").value || "").trim();
    $("admin-login-box").hidden = false;
    $("admin-panel").hidden = true;
    if (!pwd) { adminShow("err", "请先填写管理员口令"); return; }
    adminShow("info", "登录中 …");
    try {
      var res = await fetch(API + "/admin/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: pwd }).toString(),
      });
      var j = await res.json().catch(function () { return {}; });
      if (res.ok && j && j.flag && j.data && j.data.token) {
        setCredential(j.data.token);
        adminShow("ok", "登录成功" + (j.data.expiresAt ? "，会话有效期至 " + esc(fmtTime(j.data.expiresAt)) : ""));
        loadList();
        return;
      }
      // 口令登录不可用（例如只配置了静态令牌）：把输入当作令牌直接试用
      setCredential(pwd);
      var info = await verifyCredential();
      if (info) {
        adminShow("ok", "已使用静态管理令牌登录。");
        loadList();
        return;
      }
      setCredential("");
      adminShow("err", esc((j && (j.text || j.message)) || ("登录失败（HTTP " + res.status + "）")));
    } catch (err) {
      adminShow("err", "网络错误：" + esc(err && err.message ? err.message : String(err)));
    }
  }

  $("login").addEventListener("click", doLogin);
  $("password").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); doLogin(); }
  });
  $("logout").addEventListener("click", function () {
    setCredential("");
    try { localStorage.removeItem(CRED_KEY); } catch (e) {}
    $("admin-table").innerHTML = "";
    adminResult.hidden = true;
    $("password").value = "";
    $("remember").textContent = "记住令牌";
  });
  $("remember").addEventListener("click", function () {
    try {
      if (credential) { localStorage.setItem(CRED_KEY, credential); this.textContent = "已记住"; }
    } catch (e) {}
  });

  async function loadList() {
    if (!credential) { adminShow("err", "请先登录"); return; }
    adminShow("info", "加载中 …");
    try {
      var res = await fetch(API + "/admin/list", { headers: adminHeaders() });
      var j = await res.json().catch(function () { return {}; });
      if (res.status === 401 || res.status === 403) {
        if (res.status === 401) setCredential("");
        adminShow("err", esc((j && (j.text || j.message)) || "需要管理员登录"));
        return;
      }
      if (!res.ok || !j || !j.flag) {
        adminShow("err", esc((j && (j.text || j.message)) || ("HTTP " + res.status)));
        return;
      }
      var rows = (j.data && j.data.items) || [];
      if (!rows.length) { adminShow("info", "KV 中暂无分发记录"); $("admin-table").innerHTML = ""; return; }
      adminShow("info", "共 " + rows.length + " 条记录。");
      var html = "<table><thead><tr><th>指纹</th><th>方式</th><th>备注</th><th>大小</th><th>剩余次数</th><th>有效期</th><th>创建时间</th><th></th></tr></thead><tbody>";
      rows.forEach(function (it) {
        var isCode = it.mode === "code";
        html += "<tr><td class='mono'>" + esc((it.fingerprint || "").slice(0, 16)) + "…</td>" +
          "<td>" + (isCode ? "取件码" : "传输密钥") + "</td>" +
          "<td>" + esc(it.label || "-") + "</td>" +
          "<td class='mono'>" + fmtBytes(it.size || 0) + "</td>" +
          "<td class='mono'>" + (isCode && it.maxUses !== undefined ? esc(it.remaining) + " / " + esc(it.maxUses) : "-") + "</td>" +
          "<td class='mono'>" + (isCode ? esc(it.expiresAt ? fmtTime(it.expiresAt) : "永久") : "-") + "</td>" +
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
            headers: Object.assign({ "content-type": "application/x-www-form-urlencoded" }, adminHeaders()),
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

  // 页面加载：恢复「记住的令牌」并校验；未登录时按策略隐藏上传表单
  setCredential(credential);
  if (credential) {
    verifyCredential().then(function (info) {
      if (info) loadList();
      else { setCredential(""); adminShow("err", "已记住的管理员令牌已失效，请重新登录。"); }
    });
  }
`;
}
