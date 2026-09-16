import {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidIPv4,
  isValidIPv6,
  isValidCreditCard,
  isValidPassword,
  isValidJson,
  isValidDate,
  isStrongPassword,
  sanitizeInput,
  isValidHexColor,
  isValidRgbColor,
  isValidBase64,
} from './validation.utils';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate correct phone numbers', () => {
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('1234567890')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('abc')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(true); // ftp is valid
    });
  });

  describe('isValidIPv4', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIPv4('256.0.0.0')).toBe(false);
      expect(isValidIPv4('192.168.1')).toBe(false);
      expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
    });
  });

  describe('isValidIPv6', () => {
    it('should validate correct IPv6 addresses', () => {
      expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });

    it('should reject invalid IPv6 addresses', () => {
      expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370')).toBe(false);
    });
  });

  describe('isValidCreditCard', () => {
    it('should validate correct credit card numbers', () => {
      // Luhn algorithm valid numbers
      expect(isValidCreditCard('4111111111111111')).toBe(true);
      expect(isValidCreditCard('5500000000000004')).toBe(true);
    });

    it('should reject invalid credit card numbers', () => {
      expect(isValidCreditCard('1234567890123456')).toBe(false);
      expect(isValidCreditCard('1234')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should validate strong passwords', () => {
      const result = isValidPassword('StrongP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = isValidPassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('isValidJson', () => {
    it('should validate correct JSON', () => {
      expect(isValidJson('{"key": "value"}')).toBe(true);
      expect(isValidJson('[1, 2, 3]')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(isValidJson('{key: value}')).toBe(false);
      expect(isValidJson('not json')).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should validate correct dates', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('2024-01-15T10:30:00Z')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate('2024-13-45')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should validate strong passwords', () => {
      expect(isStrongPassword('StrongP@ss123')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isStrongPassword('weak')).toBe(false);
      expect(isStrongPassword('nouppercase1!')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize input', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });
  });

  describe('isValidHexColor', () => {
    it('should validate hex colors', () => {
      expect(isValidHexColor('#ff0000')).toBe(true);
      expect(isValidHexColor('#fff')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHexColor('ff0000')).toBe(false);
      expect(isValidHexColor('#gg0000')).toBe(false);
    });
  });

  describe('isValidRgbColor', () => {
    it('should validate RGB colors', () => {
      expect(isValidRgbColor('rgb(255, 0, 0)')).toBe(true);
      expect(isValidRgbColor('rgb(0, 0, 0)')).toBe(true);
    });

    it('should reject invalid RGB colors', () => {
      expect(isValidRgbColor('rgb(256, 0, 0)')).toBe(false);
      expect(isValidRgbColor('rgb(0, 0)')).toBe(false);
    });
  });

  describe('isValidBase64', () => {
    it('should validate Base64 strings', () => {
      expect(isValidBase64('SGVsbG8=')).toBe(true);
      expect(isValidBase64('SGVsbG8gV29ybGQ=')).toBe(true);
    });

    it('should reject invalid Base64 strings', () => {
      expect(isValidBase64('SGVsbG8@')).toBe(false);
    });
  });
});
