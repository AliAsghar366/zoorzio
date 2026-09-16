import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('should validate with default values', async () => {
    const dto = plainToInstance(PaginationDto, {});
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(0);
  });

  it('should validate with custom values', async () => {
    const dto = plainToInstance(PaginationDto, { limit: 50, offset: 10 });
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(10);
  });

  it('should fail with invalid limit', async () => {
    const dto = plainToInstance(PaginationDto, { limit: -1 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail with limit too high', async () => {
    const dto = plainToInstance(PaginationDto, { limit: 101 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail with negative offset', async () => {
    const dto = plainToInstance(PaginationDto, { offset: -1 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
