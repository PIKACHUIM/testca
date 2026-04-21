export interface PdfOptions {
    /** 源文件绝对路径或 Markdown 字符串 */
    source: string;
    /** 输出 PDF 路径 */
    output: string;
    /** 页眉副标题（可选） */
    subtitle?: string;
    /** 是否按 CJK 加载字体（需 zh/en 都显示时请设为 true） */
    cjk?: boolean;
}
export declare const buildPdf: (opts: PdfOptions) => void;
/** 多语言/多文档批量构建 */
export interface BuildEntry {
    /** 输出文件名（不含扩展），如 cps-zh */
    slug: string;
    /** Markdown 源 */
    source: string;
    /** PDF 的子标题 */
    subtitle?: string;
    /** 是否 CJK 字体 */
    cjk?: boolean;
}
export declare const buildAll: (entries: BuildEntry[], outputDir: string) => void;
