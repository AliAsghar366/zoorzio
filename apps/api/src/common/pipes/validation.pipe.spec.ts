import { Test, TestingModule } from '@nestjs/testing';
import { CustomValidationPipe } from './validation.pipe';
import { IsString, IsEmail, IsOptional } from 'class-validator';

class TestDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

describe('CustomValidationPipe', () => {
  let pipe: CustomValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomValidationPipe],
    }).compile();

    pipe = module.get<CustomValidationPipe>(CustomValidationPipe);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  describe('transform', () => {
    it('should pass valid data', async () => {
      const value = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = await pipe.transform(value, {
        metatype: TestDto,
        type: 'body',
      });

      expect(result).toBeDefined();
    });

    it('should pass when no metatype', async () => {
      const value = { test: 'data' };

      const result = await pipe.transform(value, {
        metatype: undefined,
        type: 'body',
      });

      expect(result).toEqual(value);
    });

    it('should fail with invalid data', async () => {
      const value = {
        name: 123, // should be string
        email: 'invalid-email', // should be valid email
      };

      await expect(
        pipe.transform(value, {
          metatype: TestDto,
          type: 'body',
        }),
      ).rejects.toThrow();
    });
  });
});
