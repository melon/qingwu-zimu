export function trimText(text: string) {
  text = text.trim();
  if (/[。，、]$/.test(text[text.length - 1])) { // 去掉中文末尾的逗号、句号
    return text.slice(0, -1);
  }
  return text;
}
