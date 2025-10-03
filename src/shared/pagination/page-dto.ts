import { ApiProperty } from '@nestjs/swagger'

export class PageDto<T> {
  @ApiProperty({ isArray: true })
  readonly items: T[]

  @ApiProperty({ example: 10 })
  readonly count: number

  @ApiProperty({ example: 2 })
  readonly pages: number

  @ApiProperty({ example: 1 })
  readonly currentPage: number

  constructor(
    items: T[],
    count: number,
    limit: number = 8,
    offset: number = 0,
  ) {
    this.items = items
    this.count = count
    this.pages = Math.ceil(count / limit) || 1
    this.currentPage = Math.floor(offset / limit + 1)
  }
}

export class PageSerializeDto<T> {
  @ApiProperty({ isArray: true })
  readonly items: T[]

  @ApiProperty({ example: 10 })
  readonly count: number

  @ApiProperty({ example: 2 })
  readonly pages: number

  @ApiProperty({ example: 1 })
  readonly currentPage: number

  constructor(items: T[], count: number, pages: number, currentPage: number) {
    this.items = items
    this.count = count
    this.pages = pages
    this.currentPage = currentPage
  }
}
