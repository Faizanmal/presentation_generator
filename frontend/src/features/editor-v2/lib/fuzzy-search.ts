export interface FuzzyItem {
  id: string;
  label: string;
  keywords: string[];
}

export interface RankedFuzzyItem<T extends FuzzyItem> {
  item: T;
  score: number;
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const scoreLabel = (query: string, candidate: string): number => {
  if (!query) {
    return 0;
  }

  if (candidate === query) {
    return 140;
  }

  if (candidate.startsWith(query)) {
    return 100 - (candidate.length - query.length) * 0.2;
  }

  const index = candidate.indexOf(query);
  if (index >= 0) {
    return 78 - index * 0.4;
  }

  let score = 0;
  let cursor = 0;

  for (const char of query) {
    const hit = candidate.indexOf(char, cursor);
    if (hit < 0) {
      return 0;
    }

    score += hit === cursor ? 8 : 4;
    cursor = hit + 1;
  }

  return score;
};

export function fuzzyRank<T extends FuzzyItem>(query: string, items: T[]): RankedFuzzyItem<T>[] {
  const normalizedQuery = normalize(query);

  return items
    .map((item) => {
      const labels = [item.label, ...item.keywords].map(normalize);
      const score = labels.reduce((best, label) => Math.max(best, scoreLabel(normalizedQuery, label)), 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0 || normalizedQuery.length === 0)
    .sort((a, b) => b.score - a.score);
}

export function fuzzyMatch(query: string, candidate: string): boolean {
  if (!query) {return true;}
  return scoreLabel(normalize(query), normalize(candidate)) > 0;
}
