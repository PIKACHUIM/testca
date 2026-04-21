/**
 * 极简 Markdown 渲染器
 * 支持：# / ## / ### 标题, 段落, 列表 (- / 1.), 加粗, 行内代码, 链接
 * 不依赖外部库，体积轻
 */
import React from 'react'

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'hr'
  text?: string
  items?: string[]
}

const parse = (src: string): Block[] => {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let buf: string[] = []
  let listBuf: string[] = []
  let listKind: 'ul' | 'ol' | null = null

  const flushPara = () => {
    if (buf.length) {
      blocks.push({ kind: 'p', text: buf.join(' ').trim() })
      buf = []
    }
  }
  const flushList = () => {
    if (listBuf.length && listKind) {
      blocks.push({ kind: listKind, items: [...listBuf] })
      listBuf = []
      listKind = null
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }

    const h = /^(#{1,4})\s+(.+)$/.exec(line)
    if (h) {
      flushPara()
      flushList()
      const lvl = h[1].length as 1 | 2 | 3 | 4
      blocks.push({ kind: `h${lvl}` as Block['kind'], text: h[2].trim() })
      continue
    }

    const ul = /^\s*[-*]\s+(.+)$/.exec(line)
    if (ul) {
      flushPara()
      if (listKind && listKind !== 'ul') flushList()
      listKind = 'ul'
      listBuf.push(ul[1].trim())
      continue
    }

    const ol = /^\s*\d+\.\s+(.+)$/.exec(line) || /^\s*\d+\.\d+(?:\.\d+)?\s+(.+)$/.exec(line)
    if (ol) {
      flushPara()
      if (listKind && listKind !== 'ol') flushList()
      listKind = 'ol'
      listBuf.push(ol[1].trim())
      continue
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushPara()
      flushList()
      blocks.push({ kind: 'hr' })
      continue
    }

    // HTML page-break line like <div STYLE="page-break-after: always;"></div>
    if (/<div[^>]*page-break/i.test(line)) {
      flushPara()
      flushList()
      continue
    }

    // Plain text
    flushList()
    buf.push(line.trim())
  }
  flushPara()
  flushList()
  return blocks
}

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  // **bold** · `code` · [text](url)
  const parts: React.ReactNode[] = []
  let remain = text
  let i = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m =
      /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/.exec(remain)
    if (!m) {
      if (remain) parts.push(<span key={`${keyPrefix}-${i++}`}>{remain}</span>)
      break
    }
    if (m.index > 0) {
      parts.push(<span key={`${keyPrefix}-${i++}`}>{remain.slice(0, m.index)}</span>)
    }
    if (m[1]) {
      parts.push(<strong key={`${keyPrefix}-${i++}`}>{m[2]}</strong>)
    } else if (m[3]) {
      parts.push(<code key={`${keyPrefix}-${i++}`}>{m[4]}</code>)
    } else if (m[5]) {
      parts.push(
        <a key={`${keyPrefix}-${i++}`} href={m[7]} target="_blank" rel="noreferrer">
          {m[6]}
        </a>,
      )
    }
    remain = remain.slice(m.index + m[0].length)
  }
  return parts
}

const MarkdownDoc: React.FC<{ source: string }> = ({ source }) => {
  const blocks = parse(source)
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        if (b.kind === 'hr') return <hr key={i} />
        if (b.kind === 'h1') return <h1 key={i}>{renderInline(b.text ?? '', `h${i}`)}</h1>
        if (b.kind === 'h2') return <h2 key={i}>{renderInline(b.text ?? '', `h${i}`)}</h2>
        if (b.kind === 'h3') return <h3 key={i}>{renderInline(b.text ?? '', `h${i}`)}</h3>
        if (b.kind === 'h4') return <h4 key={i}>{renderInline(b.text ?? '', `h${i}`)}</h4>
        if (b.kind === 'ul') {
          return (
            <ul key={i}>
              {b.items!.map((it, j) => (
                <li key={j}>{renderInline(it, `ul${i}-${j}`)}</li>
              ))}
            </ul>
          )
        }
        if (b.kind === 'ol') {
          return (
            <ol key={i}>
              {b.items!.map((it, j) => (
                <li key={j}>{renderInline(it, `ol${i}-${j}`)}</li>
              ))}
            </ol>
          )
        }
        return <p key={i}>{renderInline(b.text ?? '', `p${i}`)}</p>
      })}
    </div>
  )
}

export default MarkdownDoc
