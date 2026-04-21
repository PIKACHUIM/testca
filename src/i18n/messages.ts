/**
 * i18n · 极简文案 · 中英双语
 */

export type Lang = 'zh' | 'en'

export const LANGS: { value: Lang; short: string }[] = [
  { value: 'zh', short: 'ZH' },
  { value: 'en', short: 'EN' },
]

const STORAGE_KEY = 'pika_lang'

export const detectDefaultLang = (): Lang => {
  if (typeof window === 'undefined') return 'zh'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  if (/^zh\b/i.test(nav)) return 'zh'
  return 'en'
}

export const persistLang = (lang: Lang): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en')
  } catch {
    /* ignore */
  }
}

export const MESSAGES = {
  zh: {
    // Brand
    'brand.title': 'Pikachu Root CA',
    'brand.sub': '皮卡丘测试根证书服务',

    // Rail
    'rail.section': '导航',
    'rail.overview': '平台概览',
    'rail.root': 'CA根证书',
    'rail.sub': '中间证书',
    'rail.apply': '申请证书',
    'rail.docs': '文档索引',
    'rail.cps': '证书策略',
    'rail.privacy': '隐私声明',
    'rail.license': '协议许可',
    'rail.group.primary': '主菜单',
    'rail.group.legal': '法律文档',

    // AppBar
    'bar.root': '皮卡丘测试证书服务',

    // Common
    'common.apply': '申请证书',
    'common.get_root': '下载根证书',
    'common.bits': '位',
    'common.online': '在线',
    'common.ready': '就绪',

    // Overview
    'ov.num': '01 / 概览',
    'ov.title.a': '皮卡丘',
    'ov.title.em': '公共测试根证书服务',
    'ov.desc': '皮卡丘公共测试根证书服务 Pikachu Public Test Root CA (RSA) · 仅供开发测试使用，严禁用于生产环境。',
    'ov.notice.title': '⚠ 重要声明 · 仅供测试用途',
    'ov.notice.body': '本 CA 机构签出的时间戳和证书不会校验真实性和申请来源身份，任何人均可以随意生成任意时间戳和未经验证的证书！此 CA 机构签出的时间戳和证书仅用于测试用途，不应用于重要场合或者生产环境，未经验证的证书不应在实践中使用！！！',
    'ov.legal.title': '法律声明',
    'ov.legal.body': '本服务由个人爱好者搭建，仅供学习与研究。Pikachu Test CA 不是合法的 CA 机构，未取得任何国家或地区的电子认证服务许可，亦未被任何操作系统、浏览器或受信任根程序收录。签发的任何证书、时间戳、签名结果均无法律效力，亦不对任何使用后果承担任何责任。本项目与 The Pokémon Company、任天堂、Game Freak 或 Creatures 公司无任何关联，“Pikachu（皮卡丘）” 相关名称与形象仅作为非商业性昵称使用。继续使用本服务即视为您已知悉并同意以上全部声明。',
    'ov.stat.key': '根密钥',
    'ov.stat.sub': '中间 CA',
    'ov.stat.until': '有效至',
    'ov.stat.issuer': '签发服务',
    'ov.fp.tag': '根证书指纹',
    'ov.quick.root': '下载根证书',
    'ov.quick.sub': '浏览中间证书',
    'ov.quick.apply': '申请测试证书',
    'ov.quick.docs': '阅读策略文档',

    // Root
    'root.num': '02 / 根证书',
    'root.title.a': 'CA根',
    'root.title.em': '证书',
    'root.desc': '先安装根证书，再信任所有子 CA。',
    'root.how.title': '安装指引',
    'root.how.body': '下载后双击 → 选择"受信任的根证书颁发机构"。',
    'root.f.subject': '主体',
    'root.f.org': '组织',
    'root.f.key': '密钥',
    'root.f.valid': '有效期',
    'root.f.serial': '序列号',
    'root.f.ocsp': 'OCSP',
    'root.cps.title': '证书策略声明',
    'root.cps.desc': '使用前请阅读。',
    'root.setup.title': '一键安装包',
    'root.setup.desc': 'Windows 批处理，自动导入。',

    // Sub
    'sub.num': '03 / 中间证书',
    'sub.title.a': '中间',
    'sub.title.em': '证书',
    'sub.desc': '按场景划分的签发分支。',
    'sub.search': '搜索（time / mtls …）',
    'sub.empty': '未找到匹配项',

    // Apply
    'apply.num': '04 / 申请',
    'apply.title.a': '申请',
    'apply.title.em': '测试证书',
    'apply.desc': '三步完成：选择机构 → 填写信息 → 人机验证。',
    'apply.intro.title': '证书用途',
    'apply.intro.empty': '请先选择颁发机构，下方将展示该类型证书的适用场景。',
    'apply.step1': '选择机构',
    'apply.step2': '主体信息',
    'apply.step3': '验证提交',
    'apply.f.ca': '颁发机构',
    'apply.f.valid': '有效时间',
    'apply.f.email': '邮件',
    'apply.f.country': '国家',
    'apply.f.state': '省份',
    'apply.f.city': '城市',
    'apply.f.org': '组织',
    'apply.f.ou': '部门',
    'apply.f.desc': '描述（替代 CN）',
    'apply.f.desc.tip': 'CN 不可自定义，将使用此描述区分。',
    'apply.f.san': '可选域名（SAN）',
    'apply.notice.title': '⚠ 申请前请注意',
    'apply.notice.body': '本服务签出的证书不会验证申请来源身份，仅供测试用途，不应用于生产环境或任何重要场合。证书一旦创建无法吊销，私钥也无法禁用，请妥善保管您的私钥。',
    'apply.sum.ca': '机构',
    'apply.sum.valid': '有效期',
    'apply.sum.email': '邮件',
    'apply.sum.subject': '主体',
    'apply.privacy.title': '私钥安全',
    'apply.privacy.body': '证书无法吊销，请妥善保管私钥。',
    'apply.prev': '上一步',
    'apply.next': '下一步',
    'apply.submit': '提交申请',
    'apply.r.ca': '请选择机构',
    'apply.r.valid': '请选择有效期',
    'apply.r.email': '请填写邮件',
    'apply.i.email': '邮件格式不正确',
    'apply.r.country': '必填',
    'apply.i.country': '须为 2 位字母',
    'apply.r.state': '必填',
    'apply.r.city': '必填',
    'apply.r.org': '必填',
    'apply.r.ou': '必填',
    'apply.captcha.pass': '验证通过',
    'apply.captcha.req': '请先完成人机验证',
    'apply.ok.title': '已提交',
    'apply.ok.body': '请在新页面保存证书与私钥。',
    'apply.ok.warn': '私钥仅在您本地。',
    'apply.ok.btn': '知道了',

    // Docs (index)
    'docs.num': '05 / 文档',
    'docs.title.a': '文档与',
    'docs.title.em': '法律',
    'docs.desc': '策略、隐私、许可合集。',
    'docs.github': 'GitHub',
    'docs.cps.title': '证书策略声明',
    'docs.cps.desc': '颁发与吊销规则。',
    'docs.privacy.title': '隐私声明',
    'docs.privacy.desc': '数据收集与私钥处理。',
    'docs.license.title': '协议许可',
    'docs.license.desc': 'MIT 许可与三方依赖。',
    'docs.open': '打开',

    // CPS page
    'cps.num': '06 / CPS',
    'cps.title.a': '证书',
    'cps.title.em': '策略声明',
    'cps.desc': '颁发、验证与吊销的规范文件。',

    // Privacy page
    'privacy.num': '07 / Privacy',
    'privacy.title.a': '隐私',
    'privacy.title.em': '声明',
    'privacy.desc': '我们如何处理您的证书数据。',

    // License page
    'license.num': '08 / License',
    'license.title.a': '协议',
    'license.title.em': '许可',
    'license.desc': 'MIT 许可与三方权属。',

    // Product hints
    'prod.time.hint': '时间签名',
    'prod.uefi.hint': 'UEFI签名',
    'prod.code.hint': '代码签名',
    'prod.auth.hint': '身份认证',
    'prod.file.hint': '文件加密',
    'prod.mail.hint': '邮件加密',
    'prod.mtls.hint': '网站加密',
    'prod.sign.hint': '文档签名',

    // Product detailed use-cases
    'prod.time.use': '用于为可执行文件、脚本、文档等提供可信时间戳（RFC 3161 TSA），证明签名发生在证书有效期内，可与代码签名 / 文档签名组合使用。',
    'prod.uefi.use': '用于签名 UEFI 固件、Shim、引导加载器及 Secure Boot 场景下的 EFI 可执行文件，启用前需将根证书写入 UEFI 数据库（db）。',
    'prod.code.use': '用于签名 Windows 可执行文件（EXE / DLL / MSI）、PowerShell 脚本与驱动程序（Authenticode / 内核模式驱动）。仅供测试调试，不可用于正式发布。',
    'prod.auth.use': '用于客户端身份认证（TLS Client Auth / 智能卡登录），可作为内部系统、VPN、mTLS 网关的客户端身份凭证。',
    'prod.file.use': '用于文件加密（EFS / 文档加密 / 磁盘加密），可绑定到用户账户作为加密证书使用。',
    'prod.mail.use': '用于电子邮件 S/MIME 签名与加密，可导入到 Outlook、Thunderbird 等邮件客户端。',
    'prod.mtls.use': '用于网站 TLS / SSL 服务器证书及双向 mTLS 场景，支持填写 SAN 多域名。仅限内网 / 测试环境使用，公网浏览器将显示不受信任。',
    'prod.sign.use': '用于 PDF / Office 文档数字签名（Adobe / Microsoft Office 文档签名），需在客户端手动信任根证书后方可显示为有效签名。',

    // Legal / Footer
    'legal.copyright': '© 2025 Pikachu Public Test Root CA · 仅供测试 · 无法律效力',
    'legal.disclaimer': '本服务非合法 CA 机构，与 The Pokémon Company 无任何关联。',
  },

  en: {
    'brand.title': 'Pikachu Public Test Root CA',
    'brand.sub': 'Public Test Root · RSA',

    'rail.section': 'Navigate',
    'rail.overview': 'Overview',
    'rail.root': 'Root',
    'rail.sub': 'Intermediates',
    'rail.apply': 'Apply',
    'rail.docs': 'Docs',
    'rail.cps': 'CPS',
    'rail.privacy': 'Privacy',
    'rail.license': 'License',
    'rail.group.primary': 'Primary',
    'rail.group.legal': 'Legal',

    'bar.root': 'Pikachu Public Test Root CA',

    'common.apply': 'Apply',
    'common.get_root': 'Get Root',
    'common.bits': 'bits',
    'common.online': 'online',
    'common.ready': 'ready',

    'ov.num': '01 / Overview',
    'ov.title.a': 'Pikachu',
    'ov.title.em': 'Public Test Root CA',
    'ov.desc': 'Pikachu Public Test Root CA (RSA) · For development & testing only, NEVER use in production.',
    'ov.notice.title': '⚠ Important · Testing Use Only',
    'ov.notice.body': 'Timestamps and certificates issued by this CA are NOT verified for authenticity or applicant identity — anyone can freely generate arbitrary certificates. They are intended for testing ONLY and MUST NOT be used in production or any critical scenario.',
    'ov.legal.title': 'Legal Notice',
    'ov.legal.body': 'This service is operated by an individual hobbyist for research and learning purposes only. Pikachu Test CA is NOT a legally accredited Certificate Authority, holds no electronic certification license in any jurisdiction, and is NOT included in any operating system, browser, or trusted-root program. Any certificate, timestamp or signature produced here has no legal effect whatsoever, and no liability is accepted for any consequences of its use. This project is not affiliated with The Pokémon Company, Nintendo, Game Freak or Creatures Inc.; the "Pikachu" name and imagery are used solely as a non-commercial nickname. By continuing to use this service you acknowledge and accept this notice in full.',
    'ov.stat.key': 'Root key',
    'ov.stat.sub': 'Sub CAs',
    'ov.stat.until': 'Valid until',
    'ov.stat.issuer': 'Issuer',
    'ov.fp.tag': 'Root fingerprint',
    'ov.quick.root': 'Download root',
    'ov.quick.sub': 'Browse intermediates',
    'ov.quick.apply': 'Request a cert',
    'ov.quick.docs': 'Read the CPS',

    'root.num': '02 / Root',
    'root.title.a': 'The root',
    'root.title.em': 'certificate',
    'root.desc': 'Install the root to trust all sub CAs.',
    'root.how.title': 'Install',
    'root.how.body': 'Double-click → choose Trusted Root store.',
    'root.f.subject': 'Subject',
    'root.f.org': 'Org',
    'root.f.key': 'Key',
    'root.f.valid': 'Validity',
    'root.f.serial': 'Serial',
    'root.f.ocsp': 'OCSP',
    'root.cps.title': 'Practice Statement',
    'root.cps.desc': 'Please read before use.',
    'root.setup.title': 'Setup bundle',
    'root.setup.desc': 'Windows batch installer.',

    'sub.num': '03 / Intermediates',
    'sub.title.a': 'Intermediate',
    'sub.title.em': 'authorities',
    'sub.desc': 'Scoped signing branches.',
    'sub.search': 'Search (time / mtls …)',
    'sub.empty': 'Nothing found',

    'apply.num': '04 / Apply',
    'apply.title.a': 'Request a',
    'apply.title.em': 'test certificate',
    'apply.desc': 'Three steps: pick authority · fill subject · human verification.',
    'apply.intro.title': 'Certificate use-case',
    'apply.intro.empty': 'Please choose an issuing authority first; its use-case description will appear here.',
    'apply.step1': 'Authority',
    'apply.step2': 'Subject',
    'apply.step3': 'Verify',
    'apply.f.ca': 'Authority',
    'apply.f.valid': 'Valid range',
    'apply.f.email': 'Email',
    'apply.f.country': 'Country',
    'apply.f.state': 'State',
    'apply.f.city': 'City',
    'apply.f.org': 'Org',
    'apply.f.ou': 'OU',
    'apply.f.desc': 'Description (CN)',
    'apply.f.desc.tip': 'CN is fixed; use this as distinguisher.',
    'apply.f.san': 'SAN domains (optional)',
    'apply.notice.title': '⚠ Before you apply',
    'apply.notice.body': 'Certificates issued here are NOT identity-verified and are for testing ONLY. Do not use them in production. Once issued, a certificate cannot be revoked and the private key cannot be disabled — keep your key safe.',
    'apply.sum.ca': 'Authority',
    'apply.sum.valid': 'Validity',
    'apply.sum.email': 'Email',
    'apply.sum.subject': 'Subject',
    'apply.privacy.title': 'Key safety',
    'apply.privacy.body': 'Certs cannot be revoked. Keep your key safe.',
    'apply.prev': 'Back',
    'apply.next': 'Next',
    'apply.submit': 'Submit',
    'apply.r.ca': 'Required',
    'apply.r.valid': 'Required',
    'apply.r.email': 'Email required',
    'apply.i.email': 'Invalid email',
    'apply.r.country': 'Required',
    'apply.i.country': '2 letters only',
    'apply.r.state': 'Required',
    'apply.r.city': 'Required',
    'apply.r.org': 'Required',
    'apply.r.ou': 'Required',
    'apply.captcha.pass': 'Verified',
    'apply.captcha.req': 'Verify first',
    'apply.ok.title': 'Submitted',
    'apply.ok.body': 'Save cert & key in the new tab.',
    'apply.ok.warn': 'Key stays local.',
    'apply.ok.btn': 'Got it',

    'docs.num': '05 / Docs',
    'docs.title.a': 'Docs &',
    'docs.title.em': 'legal',
    'docs.desc': 'Policy, privacy, and license.',
    'docs.github': 'GitHub',
    'docs.cps.title': 'Certification Practice Statement',
    'docs.cps.desc': 'Issuance, verification & revocation.',
    'docs.privacy.title': 'Privacy Notice',
    'docs.privacy.desc': 'Data collected & key handling.',
    'docs.license.title': 'License',
    'docs.license.desc': 'MIT License & third-party.',
    'docs.open': 'Open',

    'cps.num': '06 / CPS',
    'cps.title.a': 'Practice',
    'cps.title.em': 'statement',
    'cps.desc': 'Rules for issuance, verification & revocation.',

    'privacy.num': '07 / Privacy',
    'privacy.title.a': 'Privacy',
    'privacy.title.em': 'notice',
    'privacy.desc': 'How we handle your certificate data.',

    'license.num': '08 / License',
    'license.title.a': 'License',
    'license.title.em': '& notices',
    'license.desc': 'MIT License and attributions.',

    'prod.time.hint': 'Time-stamp',
    'prod.uefi.hint': 'UEFI',
    'prod.code.hint': 'Code sign',
    'prod.auth.hint': 'Client auth',
    'prod.file.hint': 'File crypto',
    'prod.mail.hint': 'S/MIME',
    'prod.mtls.hint': 'mTLS / SSL',
    'prod.sign.hint': 'Doc sign',

    'prod.time.use': 'Issues RFC 3161 trusted time-stamps for executables, scripts and documents, proving the signature was made during the certificate validity window. Often paired with code / document signing.',
    'prod.uefi.use': 'Signs UEFI firmware, Shim, boot loaders and EFI executables for Secure Boot. Requires enrolling the root into the UEFI db before use.',
    'prod.code.use': 'Signs Windows executables (EXE / DLL / MSI), PowerShell scripts and drivers (Authenticode / kernel-mode). For debugging & testing only — NOT for public distribution.',
    'prod.auth.use': 'TLS client authentication (smart-card login, VPN, mTLS gateway). Issues a client identity certificate for internal systems.',
    'prod.file.use': 'File encryption (EFS, document encryption, disk encryption). Can be bound to a user account as the encryption certificate.',
    'prod.mail.use': 'S/MIME email signing and encryption. Import into Outlook, Thunderbird or any S/MIME-capable client.',
    'prod.mtls.use': 'Web TLS/SSL server certificates and mTLS. Supports SAN multi-domain. Intended for internal / test environments — public browsers will mark as untrusted.',
    'prod.sign.use': 'Digital signatures on PDF / Office documents (Adobe / Microsoft). Clients must trust the root manually for the signature to appear valid.',

    'legal.copyright': '© 2025 Pikachu Public Test Root CA · Testing only · No legal effect',
    'legal.disclaimer': 'Not a legally accredited CA. Not affiliated with The Pokémon Company.',
  },
} as const satisfies Record<Lang, Record<string, string>>

export type MessageKey = keyof (typeof MESSAGES)['zh']

export const translate = (lang: Lang, key: MessageKey): string => {
  const dict = MESSAGES[lang] as Record<string, string>
  return dict[key] ?? (MESSAGES.en as Record<string, string>)[key] ?? key
}
