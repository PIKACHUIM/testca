import type { MessageKey } from '../i18n/messages'
import type { PageKey } from '../hooks/useHashRoute'

export interface HelpSection {
  /** 小节标题 */
  title: MessageKey
  /** 小节正文（\n 分段） */
  body: MessageKey
}

export interface PageHelpDef {
  /** 抽屉标题 */
  title: MessageKey
  sections: HelpSection[]
}

const legal: PageHelpDef = {
  title: 'help.legal.title',
  sections: [
    { title: 'help.legal.1.t', body: 'help.legal.1.b' },
    { title: 'help.legal.2.t', body: 'help.legal.2.b' },
  ],
}

/**
 * 各页面的详细说明（从页面上收进「悬浮帮助」抽屉）。
 *
 * 页面只保留必要信息；背景、原理、注意事项、法律声明等长文本放这里。
 * 新增页面时补一个条目即可，未登记的页面不会渲染帮助按钮。
 */
export const PAGE_HELP: Partial<Record<PageKey, PageHelpDef>> = {
  overview: {
    title: 'help.ov.title',
    sections: [
      { title: 'help.ov.1.t', body: 'help.ov.1.b' },
      // 页面上只留一行摘要，完整声明直接复用到帮助抽屉，避免重复维护两份长文本
      { title: 'help.ov.2.t', body: 'ov.notice.body' },
      { title: 'help.ov.3.t', body: 'help.ov.3.b' },
      { title: 'help.ov.4.t', body: 'ov.legal.body' },
    ],
  },
  root: {
    title: 'help.root.title',
    sections: [
      { title: 'help.root.1.t', body: 'help.root.1.b' },
      { title: 'help.root.2.t', body: 'help.root.2.b' },
      { title: 'help.root.3.t', body: 'help.root.3.b' },
    ],
  },
  sub: {
    title: 'help.sub.title',
    sections: [
      { title: 'help.sub.1.t', body: 'help.sub.1.b' },
      { title: 'help.sub.2.t', body: 'help.sub.2.b' },
    ],
  },
  apply: {
    title: 'help.apply.title',
    sections: [
      { title: 'help.apply.1.t', body: 'help.apply.1.b' },
      { title: 'help.apply.2.t', body: 'help.apply.2.b' },
      { title: 'help.apply.3.t', body: 'help.apply.3.b' },
      { title: 'help.apply.4.t', body: 'help.apply.4.b' },
    ],
  },
  revoke: {
    title: 'help.revoke.title',
    sections: [
      { title: 'help.revoke.1.t', body: 'help.revoke.1.b' },
      { title: 'help.revoke.2.t', body: 'help.revoke.2.b' },
      { title: 'help.revoke.3.t', body: 'help.revoke.3.b' },
    ],
  },
  card: {
    title: 'help.card.title',
    sections: [
      { title: 'help.card.1.t', body: 'help.card.1.b' },
      { title: 'help.card.2.t', body: 'help.card.2.b' },
      { title: 'help.card.3.t', body: 'help.card.3.b' },
      { title: 'help.card.4.t', body: 'help.card.4.b' },
    ],
  },
  docs: {
    title: 'help.docs.title',
    sections: [
      { title: 'help.docs.1.t', body: 'help.docs.1.b' },
      { title: 'help.docs.2.t', body: 'help.docs.2.b' },
    ],
  },
  cps: legal,
  privacy: legal,
  license: legal,
}
