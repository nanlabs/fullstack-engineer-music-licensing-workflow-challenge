import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';

export function ApiController(path: string) {
  return applyDecorators(ApiTags(path), Controller(path));
}
