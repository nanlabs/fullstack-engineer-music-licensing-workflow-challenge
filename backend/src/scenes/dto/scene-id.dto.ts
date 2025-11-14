import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  SEED_CHASE_SCENE_ID,
  SEED_OPENING_SCENE_ID,
} from 'src/seed/constants/example-ids';

export class SceneIdDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The id of the scene',
    examples: {
      opening: {
        value: SEED_OPENING_SCENE_ID,
        description: 'SEED DATA - Opening',
      },
      chase: { value: SEED_CHASE_SCENE_ID, description: 'SEED DATA - Chase' },
    },
  })
  sceneId: string;
}
