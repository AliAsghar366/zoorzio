import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, getSchemaPath } from '@nestjs/swagger';

export function ApiPaginatedResponse<T extends Type<any>>(model: T) {
  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'number', example: 100 },
                  limit: { type: 'number', example: 20 },
                  offset: { type: 'number', example: 0 },
                  hasMore: { type: 'boolean', example: true },
                },
              },
              timestamp: {
                type: 'string',
                example: '2026-08-25T10:00:00.000Z',
              },
              path: {
                type: 'string',
                example: '/api/memory',
              },
            },
          },
        ],
      },
    }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'offset', required: false, type: Number }),
  );
}
