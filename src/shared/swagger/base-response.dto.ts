import { ApiProperty } from '@nestjs/swagger'

export class BaseResponseDto<T> {
  data: T
}

export class BasePaginatedResponseDto<T> {
  items: T[]
  @ApiProperty({ example: 1 })
  count: number
  @ApiProperty({ example: 1 })
  currentPage: number
  @ApiProperty({ example: 1 })
  pages: number
}

export const errorBadRequestSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status: { type: 'integer' },
        validationErrors: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
      },
      required: ['message', 'status'],
    },
  },
  required: ['error'],
}

export const errorSchema = {
  properties: {
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status: { type: 'integer' },
      },
    },
  },
}
