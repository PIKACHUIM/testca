/**
 * Markdown → PDF 构建工具（使用 pdfkit · 纯 Node，无浏览器依赖）
 * 支持：#/##/### 标题、段落、无序/有序列表、**加粗**、`行内代码`
 */
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)

type Block =
  | { k: 'h1' | 'h2' | 'h3' | 'h4'; t: string }
  | { k: 'p'; t: string }
  | { k: 'ul' | 'ol'; items: string[] }
  | { k: 'hr' }

const parse = (src: string): Block[] => {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let buf: string[] = []
  let listBuf: string[] = []
  let listKind: 'ul' | 'ol' | null = null

  const flushP = () => {
    if (buf.length) {
      blocks.push({ k: 'p', t: buf.join(' ').trim() })
      buf = []
    }
  }
  const flushL = () => {
    if (listBuf.length && listKind) {
      blocks.push({ k: listKind, items: [...listBuf] })
      listBuf = []
      listKind = null
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) {
      flushP()
      flushL()
      continue
    }
    const h = /^(#{1,4})\s+(.+)$/.exec(line)
    if (h) {
      flushP()
      flushL()
      const lvl = h[1].length as 1 | 2 | 3 | 4
      blocks.push({ k: `h${lvl}` as 'h1' | 'h2' | 'h3' | 'h4', t: h[2].trim() })
      continue
    }
    const ul = /^\s*[-*]\s+(.+)$/.exec(line)
    if (ul) {
      flushP()
      if (listKind && listKind !== 'ul') flushL()
      listKind = 'ul'
      listBuf.push(ul[1].trim())
      continue
    }
    const ol = /^\s*\d+\.\s+(.+)$/.exec(line)
    if (ol) {
      flushP()
      if (listKind && listKind !== 'ol') flushL()
      listKind = 'ol'
      listBuf.push(ol[1].trim())
      continue
    }
    if (/^\s*---+\s*$/.test(line)) {
      flushP()
      flushL()
      blocks.push({ k: 'hr' })
      continue
    }
    if (/<div[^>]*page-break/i.test(line)) {
      flushP()
      flushL()
      continue
    }
    flushL()
    buf.push(line.trim())
  }
  flushP()
  flushL()
  return blocks
}

/** 解析行内 **bold** / `code` 并按"段"逐段写入 pdfkit */
const writeInline = (
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  baseFont: string,
  boldFont: string,
  monoFont: string,
  size: number,
) => {
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      doc.font(baseFont).fontSize(size).text(text.slice(lastIdx, m.index), {
        continued: true,
      })
    }
    if (m[1]) {
      doc.font(boldFont).fontSize(size).text(m[2], { continued: true })
    } else if (m[3]) {
      doc.font(monoFont).fontSize(size - 1).text(m[4], { continued: true })
    }
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) {
    doc.font(baseFont).fontSize(size).text(text.slice(lastIdx), { continued: true })
  }
  // Close this run with a final line break (set continued: false)
  doc.text('', { continued: false })
}

export interface PdfOptions {
  /** 源文件绝对路径或 Markdown 字符串 */
  source: string
  /** 输出 PDF 路径 */
  output: string
  /** 页眉副标题（可选） */
  subtitle?: string
  /** 是否按 CJK 加载字体（需 zh/en 都显示时请设为 true） */
  cjk?: boolean
}

/** 找一个支持 CJK 的字体 · 优先 TTF/OTF（pdfkit 原生支持），次选 TTC（需 fontkit 解析） */
const findCjkFont = (): string | null => {
  const forceTtc = process.env.PIKA_FORCE_TTC === '1'
  const candidates = forceTtc
    ? [
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simsun.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      ]
    : [
        // 项目自带（最高优先级）
        path.join(process.cwd(), 'build', 'fonts', 'NotoSansSC-Regular.otf'),
        path.join(process.cwd(), 'build', 'fonts', 'NotoSansSC-Regular.ttf'),
        // Ubuntu / Debian / GitHub Actions 运行器
        '/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        // macOS
        '/System/Library/Fonts/PingFang.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
        // Windows
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/simkai.ttf',
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simsun.ttc',
      ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      /* ignore */
    }
  }
  return null
}

export const buildPdf = (opts: PdfOptions): void => {
  const src =
    /[\n#]/.test(opts.source) || !fs.existsSync(opts.source)
      ? opts.source
      : fs.readFileSync(opts.source, 'utf-8')

  const blocks = parse(src)
  const outDir = path.dirname(opts.output)
  fs.mkdirSync(outDir, { recursive: true })

  const doc = new PDFDocument({
    size: 'A4',
    margin: 56,
    info: {
      Title: opts.subtitle ?? 'Pikachu Test CA Document',
      Author: 'Pikachu Trust Network CA',
      Creator: 'Pikachu Test CA Portal',
    },
  })

  const stream = fs.createWriteStream(opts.output)
  doc.pipe(stream)

  // Fonts
  const BASE = 'Helvetica'
  const BOLD = 'Helvetica-Bold'
  const MONO = 'Courier'
  let cjkLoaded = false
  if (opts.cjk) {
    const fp = findCjkFont()
    if (fp) {
      try {
        if (fp.toLowerCase().endsWith('.ttc')) {
          // TTC 容器：通过 fontkit 读取第一个字体的 postscriptName，再由 pdfkit registerFont 按名称加载
          const fontkit = req('fontkit') as {
            openSync: (
              p: string,
              postscriptName?: string,
            ) => {
              fonts?: Array<{ postscriptName?: string }>
              postscriptName?: string
            }
          }
          const collection = fontkit.openSync(fp)
          const first = collection.fonts?.[0]
          const psName = first?.postscriptName ?? collection.postscriptName
          if (psName) {
            doc.registerFont('CJK', fp, psName)
            doc.registerFont('CJK-Bold', fp, psName)
            cjkLoaded = true
          } else {
            console.warn('[build-pdfs] TTC font has no postscriptName:', fp)
          }
        } else {
          doc.registerFont('CJK', fp)
          doc.registerFont('CJK-Bold', fp)
          cjkLoaded = true
        }
      } catch (e) {
        console.warn('[build-pdfs] CJK font load failed:', (e as Error).message)
      }
    } else {
      console.warn(
        '[build-pdfs] No CJK font found, Chinese PDF may render incorrectly.',
      )
    }
  }
  const baseFont = cjkLoaded ? 'CJK' : BASE
  const boldFont = cjkLoaded ? 'CJK-Bold' : BOLD

  // Page footer
  const footer = () => {
    const bottom = doc.page.height - 40
    doc
      .font(baseFont)
      .fontSize(8)
      .fillColor('#999999')
      .text(
        `Pikachu Test CA  ·  ${opts.subtitle ?? 'Document'}`,
        56,
        bottom,
        { align: 'left', lineBreak: false, width: doc.page.width - 112 },
      )
      .text(
        `Page ${doc.bufferedPageRange().count}`,
        56,
        bottom,
        { align: 'right', lineBreak: false, width: doc.page.width - 112 },
      )
      .fillColor('#000000')
  }

  const renderBlock = (b: Block) => {
    switch (b.k) {
      case 'h1':
        doc.moveDown(0.6)
        doc.font(boldFont).fontSize(22).fillColor('#1a1200').text(b.t)
        doc.moveTo(56, doc.y + 2).lineTo(doc.page.width - 56, doc.y + 2)
          .strokeColor('#fbbf24').lineWidth(2).stroke().strokeColor('#000000')
        doc.moveDown(0.8)
        break
      case 'h2':
        doc.moveDown(0.8)
        doc.font(boldFont).fontSize(15).fillColor('#1a1a1a').text(b.t)
        doc.moveDown(0.4)
        break
      case 'h3':
        doc.moveDown(0.5)
        doc.font(boldFont).fontSize(12.5).fillColor('#333333').text(b.t)
        doc.moveDown(0.3)
        break
      case 'h4':
        doc.moveDown(0.4)
        doc.font(boldFont).fontSize(11).fillColor('#333333').text(b.t)
        doc.moveDown(0.2)
        break
      case 'p':
        doc.fillColor('#222222')
        writeInline(doc, b.t, baseFont, boldFont, MONO, 10.5)
        doc.moveDown(0.5)
        break
      case 'ul':
        doc.fillColor('#222222')
        for (const it of b.items) {
          doc.font(baseFont).fontSize(10.5).text('  •  ', { continued: true })
          writeInline(doc, it, baseFont, boldFont, MONO, 10.5)
        }
        doc.moveDown(0.4)
        break
      case 'ol':
        doc.fillColor('#222222')
        b.items.forEach((it, i) => {
          doc.font(baseFont).fontSize(10.5).text(`  ${i + 1}.  `, { continued: true })
          writeInline(doc, it, baseFont, boldFont, MONO, 10.5)
        })
        doc.moveDown(0.4)
        break
      case 'hr':
        doc.moveDown(0.4)
        doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y)
          .strokeColor('#dddddd').lineWidth(0.5).stroke().strokeColor('#000000')
        doc.moveDown(0.5)
        break
    }
  }

  // Header band
  doc
    .rect(0, 0, doc.page.width, 44)
    .fillColor('#fbbf24')
    .fill()
    .fillColor('#1a1200')
    .font(boldFont)
    .fontSize(12)
    .text('PIKACHU · TEST CA', 56, 14, { lineBreak: false })
    .fontSize(10)
    .text(opts.subtitle ?? '', 0, 14, {
      align: 'right',
      width: doc.page.width - 56,
      lineBreak: false,
    })
    .fillColor('#000000')
    .moveDown(1.5)

  for (const b of blocks) renderBlock(b)

  // Footer on each page
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    footer()
  }

  doc.end()
}

/** 多语言/多文档批量构建 */
export interface BuildEntry {
  /** 输出文件名（不含扩展），如 cps-zh */
  slug: string
  /** Markdown 源 */
  source: string
  /** PDF 的子标题 */
  subtitle?: string
  /** 是否 CJK 字体 */
  cjk?: boolean
}

export const buildAll = (
  entries: BuildEntry[],
  outputDir: string,
): void => {
  fs.mkdirSync(outputDir, { recursive: true })
  for (const e of entries) {
    // 同步保存 Markdown 源（供前端下载）
    fs.writeFileSync(path.join(outputDir, `${e.slug}.md`), e.source, 'utf-8')
    // 生成 PDF
    buildPdf({
      source: e.source,
      output: path.join(outputDir, `${e.slug}.pdf`),
      subtitle: e.subtitle,
      cjk: e.cjk,
    })
  }
}
