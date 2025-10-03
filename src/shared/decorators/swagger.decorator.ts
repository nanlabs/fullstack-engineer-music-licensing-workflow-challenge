import {
  ApiNoContentResponse,
  ApiHeaderOptions,
  ApiParamOptions,
  ApiOperation,
  ApiHeaders,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { applyDecorators, Type } from '@nestjs/common'

import {
  buildResponseCodeExamples,
  CustomApiCreatedResponse,
  ApiOkResponsePaginated,
  CustomApiOkResponse,
  ResponseCodes,
  HttpMethods,
} from '../swagger/api-responses-docs'

export const SwaggerDocs = <DataDto extends Type<unknown>>(schema: {
  dataDto: DataDto | null
  isPaginated: boolean
  httpMethod: HttpMethods
  errorResponseCodes: ResponseCodes[]
  tags: string
  description: string
  summary: string
  headers?: ApiHeaderOptions[]
  params?: ApiParamOptions
}) => {
  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = []

  decorators.push(
    ApiOperation({
      description: schema.description,
      summary: schema.summary,
    }),
    ApiTags(schema.tags),
  )

  if (schema.params) {
    decorators.push(ApiParam(schema.params))
  }

  if (schema.headers) {
    decorators.push(ApiHeaders(schema.headers))
  }

  if (schema.httpMethod === HttpMethods.delete || !schema.dataDto) {
    decorators.push(
      ApiNoContentResponse({ description: 'No content success response' }),
    )
  } else if (schema.httpMethod === HttpMethods.get) {
    const responseDecorator = schema.isPaginated
      ? ApiOkResponsePaginated(schema.dataDto)
      : CustomApiOkResponse(schema.dataDto)

    decorators.push(responseDecorator)
  } else {
    decorators.push(CustomApiCreatedResponse(schema.dataDto))
  }

  const errorCodeResponses = buildResponseCodeExamples(
    schema.errorResponseCodes,
  )

  return applyDecorators(...decorators, ...errorCodeResponses)
}
