import { Injectable, NotFoundException } from '@nestjs/common';
import { Contact } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.contact.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }

  private async findOwned(userId: string, id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact || contact.userId !== userId) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async findOne(userId: string, id: string) {
    return this.findOwned(userId, id);
  }

  async create(userId: string, dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: {
        userId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ? normalizePhone(dto.phone) : undefined,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    await this.findOwned(userId, id);

    return this.prisma.contact.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ? normalizePhone(dto.phone) : dto.phone === null ? null : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Finds every contact whose name plausibly matches what the user said.
   *
   * Returns all matches rather than a best guess: "email Ahmed" with two
   * Ahmeds in the address book must produce a question, not a coin flip, since
   * the resulting action (an email, a calendar invite) reaches a real person
   * and can't be taken back.
   */
  async search(userId: string, query: string): Promise<Contact[]> {
    const term = query.trim();
    if (!term) return [];

    return this.prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
}

/** Strips formatting so stored numbers are comparable; leaves a leading + intact. */
function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}
