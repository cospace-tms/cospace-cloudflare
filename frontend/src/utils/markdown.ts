import { marked } from 'marked';

/**
 * 安全にマークダウンをHTMLにパースする
 * 事前にHTML特殊文字をエスケープしてXSSを防止
 */
export function parseMarkdownToHtml(md: string): string {
  if (!md) return '';

  // 1. HTMLエスケープしてXSSを防ぐ
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 2. markedでパース
  const rawHtml = marked.parse(escaped, { async: false }) as string;

  // 3. パースされた見出し要素（<h1>〜<h6>）に、TOCスクロール用のIDを動的に付与する
  let headingIndex = 0;
  const processedHtml = rawHtml.replace(/<(h[1-6])(.*?)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
    const id = `heading-${headingIndex++}`;
    return `<${tag} id="${id}" class="md-${tag}"${attrs}>${content}</${tag}>`;
  });

  return processedHtml;
}

/**
 * マークダウンから目次（TOC）情報を生成
 */
export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function extractTocFromMarkdown(md: string): TocItem[] {
  if (!md) return [];

  const toc: TocItem[] = [];
  const lines = md.split('\n');
  let headingIndex = 0;

  lines.forEach((line) => {
    const match = line.trim().match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2]
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1');

      const id = `heading-${headingIndex++}`;
      toc.push({ level, text, id });
    }
  });

  return toc;
}

/**
 * カンバンカード表示用にマークダウン記号を除去してプレーンテキストにする
 */
export function stripMarkdown(md: string): string {
  if (!md) return '';
  return md
    .replace(/^(#{1,6})\s+/gm, '') // 見出し記号
    .replace(/\*\*(.*?)\*\*/g, '$1') // 太字
    .replace(/\*(.*?)\*/g, '$1') // 斜体
    .replace(/~~(.*?)~~/g, '$1') // 取り消し線
    .replace(/`(.*?)`/g, '$1') // インラインコード
    .replace(/```[\s\S]*?```/g, '') // コードブロック
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // リンク
    .replace(/^[-*+]\s+/gm, '') // リスト記号
    .replace(/^\d+\.\s+/gm, '') // 番号付きリスト記号
    .replace(/\n/g, ' '); // 改行をスペースに置換
}
