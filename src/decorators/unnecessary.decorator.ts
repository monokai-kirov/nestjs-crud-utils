import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export function UnnecessaryDecorator() {
	return applyDecorators(
		ApiProperty({
			description:
				'НЕ указывайте это свойство при отправке данных, т.к. правильное значение подставится в коде бэка и нужно оно лишь для правильной работы валидации. Даже если вы укажете это свойство, оно заменится на правильное значение в коде бэка',
		}),
		ApiPropertyOptional(),
	);
}
