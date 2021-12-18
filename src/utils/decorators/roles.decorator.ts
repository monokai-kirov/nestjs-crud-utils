import { SetMetadata } from '@nestjs/common';

export const RolesDecorator = (...roles: string[]): ReturnType<typeof SetMetadata> =>
	SetMetadata('roles', roles);
