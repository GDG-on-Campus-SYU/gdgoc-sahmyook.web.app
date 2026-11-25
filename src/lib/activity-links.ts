export function readLinkTitles(value: unknown) {
  const titles = new Map<string, string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item?.url === "string" && typeof item.title === "string" && item.title.trim()) {
        titles.set(item.url, item.title.trim());
      }
    }
  }
  return titles;
}

export function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function parseActivityLinks(input: string) {
  const links: string[] = [];
  const titles = new Map<string, string>();
  const lines = input.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    const parts = /^(.*?)\s+\|\s+(\S+)$/.exec(line);
    const title = parts?.[1].trim();
    const url = parts?.[2] ?? line;
    if (!/^https?:\/\/\S+$/i.test(url) || !isHttpUrl(url)) {
      return { error: `관련 링크 ${index + 1}행의 주소를 확인해 주세요. http 또는 https 주소를 입력할 수 있습니다.` } as const;
    }
    if (title && titles.has(url) && titles.get(url) !== title) {
      return { error: `관련 링크 ${index + 1}행의 주소가 다른 이름으로 이미 입력되어 있습니다.` } as const;
    }
    links.push(url);
    if (title) titles.set(url, title);
  }
  return { links, linkTitles: Array.from(titles, ([url, title]) => ({ url, title })) } as const;
}
