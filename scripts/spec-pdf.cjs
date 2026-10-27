// AI API 명세서 MD → HTML → PDF(새 의존성 없이 Playwright 크로미움으로 인쇄). npm run docs:api-pdf
// 쓰는 법: node scripts/spec-pdf.cjs [in.md] [out.pdf] [out.html] — 기본 docs/AI-API-명세서.md → docs/AI-API-명세서.pdf
const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')

const ROOT = path.resolve(__dirname, '..')
const [, , inPath = path.join(ROOT, 'docs/AI-API-명세서.md'), outPdf = path.join(ROOT, 'docs/AI-API-명세서.pdf'), outHtml] = process.argv
const md = fs.readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function inline(s) {
  // 코드 조각을 먼저 빼 두고 굵게만 처리한다
  const codes = []
  let t = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c)
    return `\u0000${codes.length - 1}\u0000`
  })
  t = esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`)
}

const lines = md.split('\n')
const out = []
let i = 0
let h2Count = 0
while (i < lines.length) {
  const line = lines[i]
  if (line.startsWith('```')) {
    const lang = line.slice(3).trim()
    const buf = []
    i++
    while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
    i++
    out.push(`<pre class="code ${lang}"><code>${esc(buf.join('\n'))}</code></pre>`)
    continue
  }
  const h = /^(#{1,4})\s+(.*)$/.exec(line)
  if (h) {
    const level = h[1].length
    const text = h[2]
    let cls = ''
    if (level === 2) {
      h2Count++
      // API 1·API 2·공고 필드는 새 쪽에서 시작(첨부 양식처럼 API마다 한 묶음)
      if (/^(1\.|2\.|공고 posting)/.test(text)) cls = ' class="page"'
    }
    out.push(`<h${level}${cls}>${inline(text)}</h${level}>`)
    i++
    continue
  }
  if (line.startsWith('|')) {
    const rows = []
    while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
    const cells = (r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    const head = cells(rows[0])
    const body = rows.slice(2).map(cells)
    out.push(
      `<table${body.length <= 6 ? ' class="small"' : body.length > 20 ? ' class="long"' : ''}><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`,
    )
    continue
  }
  if (line.startsWith('>')) {
    const buf = []
    while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''))
    out.push(`<blockquote>${buf.map(inline).join('<br>')}</blockquote>`)
    continue
  }
  if (/^- /.test(line)) {
    const buf = []
    while (i < lines.length && /^- /.test(lines[i])) buf.push(lines[i++].slice(2))
    out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`)
    continue
  }
  if (line.trim() === '') {
    i++
    continue
  }
  const buf = []
  while (i < lines.length && lines[i].trim() !== '' && !/^(#|\||>|```|- )/.test(lines[i])) buf.push(lines[i++])
  out.push(`<p>${inline(buf.join(' '))}</p>`)
}

const title = (/^# (.*)$/m.exec(md) || [, 'API 명세서'])[1]
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif; font-size: 9.6pt; line-height: 1.6; color: #24292f; background: #fff; }
  h1 { font-size: 21pt; color: #1d5b94; margin: 0 0 6pt; letter-spacing: -0.3pt; }
  h1 + p { color: #57606a; font-size: 10pt; margin-top: 0; }
  h2 { font-size: 14pt; color: #1f2328; margin: 20pt 0 8pt; padding-bottom: 5pt; border-bottom: 1.6pt solid #1d5b94; break-after: avoid; }
  h2.page { break-before: page; margin-top: 0; }
  h3 { font-size: 12pt; color: #1f2328; margin: 16pt 0 6pt; break-after: avoid; }
  h4 { font-size: 10.5pt; color: #1f2328; margin: 12pt 0 5pt; break-after: avoid; }
  p { margin: 5pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 8.9pt; }
  th, td { border: 0.75pt solid #d0d7de; padding: 4.5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #eef1f4; font-weight: 700; white-space: nowrap; }
  tr { break-inside: avoid; }
  /* 첫 칸이 필드 이름(코드)뿐이면 끊지 않고, 글이면 최소 폭을 둔다 */
  td:first-child { min-width: 7.5em; }
  td:first-child:has(> code:only-child) { white-space: nowrap; }
  td:first-child > code:only-child { word-break: normal; }
  /* 작은 표는 쪽에서 나누지 않고, 바로 앞 설명 글·제목과 같은 쪽에 둔다 */
  table.small { break-inside: avoid; }
  table.long th, table.long td { padding: 3pt 7pt; }
  td:last-child { min-width: 9em; }
  p:has(+ table), p:has(+ pre) { break-after: avoid; }
  code { font-family: Consolas, "D2Coding", monospace; font-size: 8.4pt; background: #eff1f3; border-radius: 3pt; padding: 0.5pt 3pt; word-break: break-all; }
  pre.code { background: #f6f8fa; border: 0.75pt solid #d0d7de; border-radius: 4pt; padding: 8pt 10pt; margin: 6pt 0 10pt; white-space: pre-wrap; word-break: break-all; font-size: 8pt; line-height: 1.45; }
  pre.code code { background: none; padding: 0; font-size: 8pt; }
  blockquote { margin: 6pt 0 10pt; padding: 5pt 10pt; border-left: 3pt solid #c4ccd5; background: #f7f8fa; color: #57606a; font-size: 8.8pt; }
  ul { margin: 4pt 0 8pt; padding-left: 16pt; }
  strong { color: #1f2328; }
</style></head><body>
${out.join('\n')}
</body></html>`

if (outHtml) fs.writeFileSync(outHtml, html)

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-family:'Malgun Gothic',sans-serif;font-size:7.5pt;color:#8c959f;padding:0 15mm;display:flex;justify-content:space-between"><span>${esc(title)} · askback24</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  })
  await browser.close()
  console.log('pdf ok', path.resolve(outPdf))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
