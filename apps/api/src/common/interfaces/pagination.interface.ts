export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  timestamp: string;
  path: string;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
  path: string,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    timestamp: new Date().toISOString(),
    path,
  };
}
