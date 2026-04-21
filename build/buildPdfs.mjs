var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/**
 * Markdown → PDF 构建工具（使用 pdfkit · 纯 Node，无浏览器依赖）
 * 支持：#/##/### 标题、段落、无序/有序列表、**加粗**、`行内代码`
 */
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
var parse = function (src) {
    var blocks = [];
    var lines = src.replace(/\r\n/g, '\n').split('\n');
    var buf = [];
    var listBuf = [];
    var listKind = null;
    var flushP = function () {
        if (buf.length) {
            blocks.push({ k: 'p', t: buf.join(' ').trim() });
            buf = [];
        }
    };
    var flushL = function () {
        if (listBuf.length && listKind) {
            blocks.push({ k: listKind, items: __spreadArray([], listBuf, true) });
            listBuf = [];
            listKind = null;
        }
    };
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var raw = lines_1[_i];
        var line = raw.replace(/\s+$/, '');
        if (!line.trim()) {
            flushP();
            flushL();
            continue;
        }
        var h = /^(#{1,4})\s+(.+)$/.exec(line);
        if (h) {
            flushP();
            flushL();
            var lvl = h[1].length;
            blocks.push({ k: "h".concat(lvl), t: h[2].trim() });
            continue;
        }
        var ul = /^\s*[-*]\s+(.+)$/.exec(line);
        if (ul) {
            flushP();
            if (listKind && listKind !== 'ul')
                flushL();
            listKind = 'ul';
            listBuf.push(ul[1].trim());
            continue;
        }
        var ol = /^\s*\d+\.\s+(.+)$/.exec(line);
        if (ol) {
            flushP();
            if (listKind && listKind !== 'ol')
                flushL();
            listKind = 'ol';
            listBuf.push(ol[1].trim());
            continue;
        }
        if (/^\s*---+\s*$/.test(line)) {
            flushP();
            flushL();
            blocks.push({ k: 'hr' });
            continue;
        }
        if (/<div[^>]*page-break/i.test(line)) {
            flushP();
            flushL();
            continue;
        }
        flushL();
        buf.push(line.trim());
    }
    flushP();
    flushL();
    return blocks;
};
/** 解析行内 **bold** / `code` 并按"段"逐段写入 pdfkit */
var writeInline = function (doc, text, baseFont, boldFont, monoFont, size) {
    var re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    var lastIdx = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIdx) {
            doc.font(baseFont).fontSize(size).text(text.slice(lastIdx, m.index), {
                continued: true,
            });
        }
        if (m[1]) {
            doc.font(boldFont).fontSize(size).text(m[2], { continued: true });
        }
        else if (m[3]) {
            doc.font(monoFont).fontSize(size - 1).text(m[4], { continued: true });
        }
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) {
        doc.font(baseFont).fontSize(size).text(text.slice(lastIdx), { continued: true });
    }
    // Close this run with a final line break (set continued: false)
    doc.text('', { continued: false });
};
/** 找一个支持 CJK 的字体（ubuntu / macOS / windows） */
var findCjkFont = function () {
    var candidates = [
        // Windows
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/msyh.ttf',
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/simsun.ttc',
        // macOS
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
        // Ubuntu / Debian / CI
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    ];
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var p = candidates_1[_i];
        try {
            if (fs.existsSync(p))
                return p;
        }
        catch (_a) {
            /* ignore */
        }
    }
    return null;
};
export var buildPdf = function (opts) {
    var _a, _b;
    var src = /[\n#]/.test(opts.source) || !fs.existsSync(opts.source)
        ? opts.source
        : fs.readFileSync(opts.source, 'utf-8');
    var blocks = parse(src);
    var outDir = path.dirname(opts.output);
    fs.mkdirSync(outDir, { recursive: true });
    var doc = new PDFDocument({
        size: 'A4',
        margin: 56,
        info: {
            Title: (_a = opts.subtitle) !== null && _a !== void 0 ? _a : 'Pikachu Test CA Document',
            Author: 'Pikachu Trust Network CA',
            Creator: 'Pikachu Test CA Portal',
        },
    });
    var stream = fs.createWriteStream(opts.output);
    doc.pipe(stream);
    // Fonts
    var BASE = 'Helvetica';
    var BOLD = 'Helvetica-Bold';
    var MONO = 'Courier';
    var cjkLoaded = false;
    if (opts.cjk) {
        var fp = findCjkFont();
        if (fp) {
            try {
                doc.registerFont('CJK', fp);
                doc.registerFont('CJK-Bold', fp);
                cjkLoaded = true;
            }
            catch (_c) {
                /* ignore */
            }
        }
    }
    var baseFont = cjkLoaded ? 'CJK' : BASE;
    var boldFont = cjkLoaded ? 'CJK-Bold' : BOLD;
    // Page footer
    var footer = function () {
        var _a;
        var bottom = doc.page.height - 40;
        doc
            .font(baseFont)
            .fontSize(8)
            .fillColor('#999999')
            .text("Pikachu Test CA  \u00B7  ".concat((_a = opts.subtitle) !== null && _a !== void 0 ? _a : 'Document'), 56, bottom, { align: 'left', lineBreak: false, width: doc.page.width - 112 })
            .text("Page ".concat(doc.bufferedPageRange().count), 56, bottom, { align: 'right', lineBreak: false, width: doc.page.width - 112 })
            .fillColor('#000000');
    };
    var renderBlock = function (b) {
        switch (b.k) {
            case 'h1':
                doc.moveDown(0.6);
                doc.font(boldFont).fontSize(22).fillColor('#1a1200').text(b.t);
                doc.moveTo(56, doc.y + 2).lineTo(doc.page.width - 56, doc.y + 2)
                    .strokeColor('#fbbf24').lineWidth(2).stroke().strokeColor('#000000');
                doc.moveDown(0.8);
                break;
            case 'h2':
                doc.moveDown(0.8);
                doc.font(boldFont).fontSize(15).fillColor('#1a1a1a').text(b.t);
                doc.moveDown(0.4);
                break;
            case 'h3':
                doc.moveDown(0.5);
                doc.font(boldFont).fontSize(12.5).fillColor('#333333').text(b.t);
                doc.moveDown(0.3);
                break;
            case 'h4':
                doc.moveDown(0.4);
                doc.font(boldFont).fontSize(11).fillColor('#333333').text(b.t);
                doc.moveDown(0.2);
                break;
            case 'p':
                doc.fillColor('#222222');
                writeInline(doc, b.t, baseFont, boldFont, MONO, 10.5);
                doc.moveDown(0.5);
                break;
            case 'ul':
                doc.fillColor('#222222');
                for (var _i = 0, _a = b.items; _i < _a.length; _i++) {
                    var it = _a[_i];
                    doc.font(baseFont).fontSize(10.5).text('  •  ', { continued: true });
                    writeInline(doc, it, baseFont, boldFont, MONO, 10.5);
                }
                doc.moveDown(0.4);
                break;
            case 'ol':
                doc.fillColor('#222222');
                b.items.forEach(function (it, i) {
                    doc.font(baseFont).fontSize(10.5).text("  ".concat(i + 1, ".  "), { continued: true });
                    writeInline(doc, it, baseFont, boldFont, MONO, 10.5);
                });
                doc.moveDown(0.4);
                break;
            case 'hr':
                doc.moveDown(0.4);
                doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y)
                    .strokeColor('#dddddd').lineWidth(0.5).stroke().strokeColor('#000000');
                doc.moveDown(0.5);
                break;
        }
    };
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
        .text((_b = opts.subtitle) !== null && _b !== void 0 ? _b : '', 0, 14, {
        align: 'right',
        width: doc.page.width - 56,
        lineBreak: false,
    })
        .fillColor('#000000')
        .moveDown(1.5);
    for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
        var b = blocks_1[_i];
        renderBlock(b);
    }
    // Footer on each page
    var range = doc.bufferedPageRange();
    for (var i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        footer();
    }
    doc.end();
};
export var buildAll = function (entries, outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var e = entries_1[_i];
        // 同步保存 Markdown 源（供前端下载）
        fs.writeFileSync(path.join(outputDir, "".concat(e.slug, ".md")), e.source, 'utf-8');
        // 生成 PDF
        buildPdf({
            source: e.source,
            output: path.join(outputDir, "".concat(e.slug, ".pdf")),
            subtitle: e.subtitle,
            cjk: e.cjk,
        });
    }
};
