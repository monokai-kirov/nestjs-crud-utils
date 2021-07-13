import { SetMetadata } from '@nestjs/common';

export const RolesDecorator = (...roles: string[]) => SetMetadata('roles', roles);
