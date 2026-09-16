import {
  truncate,
  slugify,
  capitalize,
  camelCase,
  snakeCase,
  kebabCase,
  truncateWords,
  escapeHtml,
  unescapeHtml,
  stripHtml,
  extractUrls,
  extractEmails,
  extractPhoneNumbers,
  generateId,
  padStart,
  padEnd,
  removeDiacritics,
  countWords,
  countCharacters,
} from './string.utils';

describe('String Utils', () => {
  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 5)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hi', 5)).toBe('Hi');
    });

    it('should use custom suffix', () => {
      expect(truncate('Hello World', 5, '---')).toBe('Hello---');
    });
  });

  describe('slugify', () => {
    it('should create slug from text', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      expect(slugify('Hello! @World#')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase rest of string', () => {
      expect(capitalize('HELLO')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('camelCase', () => {
    it('should convert to camelCase', () => {
      expect(camelCase('hello-world')).toBe('helloWorld');
    });

    it('should handle snake_case', () => {
      expect(camelCase('hello_world')).toBe('helloWorld');
    });
  });

  describe('snakeCase', () => {
    it('should convert to snake_case', () => {
      expect(snakeCase('helloWorld')).toBe('hello_world');
    });

    it('should handle kebab-case', () => {
      expect(snakeCase('hello-world')).toBe('hello_world');
    });
  });

  describe('kebabCase', () => {
    it('should convert to kebab-case', () => {
      expect(kebabCase('helloWorld')).toBe('hello-world');
    });

    it('should handle snake_case', () => {
      expect(kebabCase('hello_world')).toBe('hello-world');
    });
  });

  describe('truncateWords', () => {
    it('should truncate by word count', () => {
      expect(truncateWords('Hello World Foo Bar', 2)).toBe('Hello World...');
    });

    it('should not truncate if within limit', () => {
      expect(truncateWords('Hello', 2)).toBe('Hello');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
    });
  });

  describe('unescapeHtml', () => {
    it('should unescape HTML entities', () => {
      expect(unescapeHtml('&lt;script&gt;')).toBe('<script>');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    });
  });

  describe('extractUrls', () => {
    it('should extract URLs from text', () => {
      const text = 'Visit https://example.com and http://test.com';
      const urls = extractUrls(text);
      expect(urls).toEqual(['https://example.com', 'http://test.com']);
    });

    it('should return empty array if no URLs', () => {
      const text = 'No URLs here';
      const urls = extractUrls(text);
      expect(urls).toEqual([]);
    });
  });

  describe('extractEmails', () => {
    it('should extract emails from text', () => {
      const text = 'Contact test@example.com or user@domain.org';
      const emails = extractEmails(text);
      expect(emails).toEqual(['test@example.com', 'user@domain.org']);
    });
  });

  describe('generateId', () => {
    it('should generate ID of specified length', () => {
      const id = generateId(10);
      expect(id.length).toBe(10);
    });

    it('should generate alphanumeric ID', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('padStart', () => {
    it('should pad string at start', () => {
      expect(padStart('5', 3, '0')).toBe('005');
    });
  });

  describe('padEnd', () => {
    it('should pad string at end', () => {
      expect(padEnd('5', 3, '0')).toBe('500');
    });
  });

  describe('removeDiacritics', () => {
    it('should remove diacritics', () => {
      expect(removeDiacritics('café')).toBe('cafe');
    });
  });

  describe('countWords', () => {
    it('should count words', () => {
      expect(countWords('Hello World')).toBe(2);
    });

    it('should handle extra spaces', () => {
      expect(countWords('  Hello   World  ')).toBe(2);
    });
  });

  describe('countCharacters', () => {
    it('should count characters with spaces', () => {
      expect(countCharacters('Hello World', true)).toBe(11);
    });

    it('should count characters without spaces', () => {
      expect(countCharacters('Hello World', false)).toBe(10);
    });
  });
});
