import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@anchor/database';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Requires RolesGuard to be applied. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
