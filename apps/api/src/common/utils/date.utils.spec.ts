import {
  formatDate,
  isToday,
  isTomorrow,
  isYesterday,
  isOverdue,
  getDaysUntil,
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  addDays,
  addHours,
  addMinutes,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  formatRelativeTime,
} from './date.utils';

describe('Date Utils', () => {
  describe('formatDate', () => {
    it('should format date', () => {
      const date = new Date('2024-01-15T10:30:00');
      expect(formatDate(date)).toBe('2024-01-15');
    });

    it('should format with time', () => {
      const date = new Date('2024-01-15T10:30:00');
      expect(formatDate(date, 'YYYY-MM-DD HH:mm')).toBe('2024-01-15 10:30');
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('should return false for other days', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isTomorrow', () => {
    it('should return true for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isTomorrow(tomorrow)).toBe(true);
    });

    it('should return false for other days', () => {
      expect(isTomorrow(new Date())).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isYesterday(yesterday)).toBe(true);
    });

    it('should return false for other days', () => {
      expect(isYesterday(new Date())).toBe(false);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(isOverdue(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(isOverdue(futureDate)).toBe(false);
    });
  });

  describe('getDaysUntil', () => {
    it('should return positive days for future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      expect(getDaysUntil(futureDate)).toBe(5);
    });

    it('should return negative days for past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      expect(getDaysUntil(pastDate)).toBe(-5);
    });
  });

  describe('getStartOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2024-01-15T10:30:00');
      const start = getStartOfDay(date);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });
  });

  describe('getEndOfDay', () => {
    it('should return end of day', () => {
      const date = new Date('2024-01-15T10:30:00');
      const end = getEndOfDay(date);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });
  });

  describe('getStartOfWeek', () => {
    it('should return start of week', () => {
      const date = new Date('2024-01-17'); // Wednesday
      const start = getStartOfWeek(date);
      expect(start.getDay()).toBe(0); // Sunday
    });
  });

  describe('getEndOfWeek', () => {
    it('should return end of week', () => {
      const date = new Date('2024-01-17'); // Wednesday
      const end = getEndOfWeek(date);
      expect(end.getDay()).toBe(6); // Saturday
    });
  });

  describe('getStartOfMonth', () => {
    it('should return start of month', () => {
      const date = new Date('2024-01-15');
      const start = getStartOfMonth(date);
      expect(start.getDate()).toBe(1);
    });
  });

  describe('getEndOfMonth', () => {
    it('should return end of month', () => {
      const date = new Date('2024-01-15');
      const end = getEndOfMonth(date);
      expect(end.getDate()).toBe(31);
    });
  });

  describe('addDays', () => {
    it('should add days', () => {
      const date = new Date('2024-01-15');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });
  });

  describe('addHours', () => {
    it('should add hours', () => {
      const date = new Date('2024-01-15T10:00:00');
      const result = addHours(date, 5);
      expect(result.getHours()).toBe(15);
    });
  });

  describe('addMinutes', () => {
    it('should add minutes', () => {
      const date = new Date('2024-01-15T10:00:00');
      const result = addMinutes(date, 30);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('differenceInDays', () => {
    it('should calculate difference in days', () => {
      const date1 = new Date('2024-01-20');
      const date2 = new Date('2024-01-15');
      expect(differenceInDays(date1, date2)).toBe(5);
    });
  });

  describe('differenceInHours', () => {
    it('should calculate difference in hours', () => {
      const date1 = new Date('2024-01-15T15:00:00');
      const date2 = new Date('2024-01-15T10:00:00');
      expect(differenceInHours(date1, date2)).toBe(5);
    });
  });

  describe('differenceInMinutes', () => {
    it('should calculate difference in minutes', () => {
      const date1 = new Date('2024-01-15T10:30:00');
      const date2 = new Date('2024-01-15T10:00:00');
      expect(differenceInMinutes(date1, date2)).toBe(30);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent time', () => {
      const recent = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      expect(formatRelativeTime(recent)).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const minutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      expect(formatRelativeTime(minutesAgo)).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      expect(formatRelativeTime(hoursAgo)).toBe('3h ago');
    });

    it('should format days ago', () => {
      const daysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      expect(formatRelativeTime(daysAgo)).toBe('2d ago');
    });
  });
});
