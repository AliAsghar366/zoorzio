export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) {
    return str;
  }
  return str.substring(0, length) + suffix;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function camelCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

export function snakeCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/_+/g, '_');
}

export function kebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function truncateWords(text: string, wordCount: number): string {
  const words = text.split(' ');
  if (words.length <= wordCount) {
    return text;
  }
  return words.slice(0, wordCount).join(' ') + '...';
}

export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

export function unescapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
  };

  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, (entity) => htmlEntities[entity] || entity);
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

export function extractPhoneNumbers(text: string): string[] {
  const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;
  return text.match(phoneRegex) || [];
}

export function generateId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function padStart(str: string, targetLength: number, padString: string = ' '): string {
  return str.padStart(targetLength, padString);
}

export function padEnd(str: string, targetLength: number, padString: string = ' '): string {
  return str.padEnd(targetLength, padString);
}

export function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function countCharacters(text: string, includeSpaces: boolean = true): number {
  if (includeSpaces) {
    return text.length;
  }
  return text.replace(/\s/g, '').length;
}
