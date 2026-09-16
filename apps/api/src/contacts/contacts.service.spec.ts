import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      contact: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ContactsService);
  });

  describe('create', () => {
    it('stores the contact against the acting user', async () => {
      await service.create('user1', { name: 'Ahmed Khan', email: 'ahmed@example.com' });

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          name: 'Ahmed Khan',
          email: 'ahmed@example.com',
          phone: undefined,
        },
      });
    });

    it('normalizes a formatted phone number so it can be matched later', async () => {
      await service.create('user1', { name: 'Ahmed', phone: '+44 (784) 847-2822' });

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+447848472822' }),
        }),
      );
    });

    it('keeps a number without a country code as-is apart from formatting', async () => {
      await service.create('user1', { name: 'Ahmed', phone: '0784 847 2822' });

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '07848472822' }),
        }),
      );
    });
  });

  describe('search', () => {
    it('scopes the lookup to the asking user', async () => {
      await service.search('user1', 'Ahmed');

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user1' }),
        }),
      );
    });

    it('returns every match rather than a best guess', async () => {
      // The caller has to be able to tell "one Ahmed" from "two Ahmeds", since
      // the resulting email or invitation reaches a real person.
      prisma.contact.findMany.mockResolvedValue([
        { id: 'c1', name: 'Ahmed Khan' },
        { id: 'c2', name: 'Ahmed Ali' },
      ]);

      await expect(service.search('user1', 'Ahmed')).resolves.toHaveLength(2);
    });

    it('does not query at all for an empty search', async () => {
      await expect(service.search('user1', '   ')).resolves.toEqual([]);
      expect(prisma.contact.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ownership', () => {
    it("refuses to read another user's contact", async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: 'c1', userId: 'someone-else' });

      await expect(service.findOne('user1', 'c1')).rejects.toThrow(NotFoundException);
    });

    it("refuses to update another user's contact", async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: 'c1', userId: 'someone-else' });

      await expect(service.update('user1', 'c1', { name: 'Hacked' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it("refuses to delete another user's contact", async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: 'c1', userId: 'someone-else' });

      await expect(service.remove('user1', 'c1')).rejects.toThrow(NotFoundException);
      expect(prisma.contact.delete).not.toHaveBeenCalled();
    });

    it('reports a missing contact the same way as one owned by someone else', async () => {
      // Same error either way, so the response cannot be used to probe whether
      // a given contact id exists on another account.
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user1', 'c1')).rejects.toThrow(NotFoundException);
    });
  });
});
