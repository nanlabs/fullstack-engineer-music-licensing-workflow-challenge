import { PartialType } from '@nestjs/mapped-types';
import { CreateSceneDto } from './create-scene.dto';

export class UpdateSceneDto extends PartialType(CreateSceneDto) {}
