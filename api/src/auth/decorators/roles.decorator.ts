import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export enum Role {
  ADMIN = 'ADMIN',
  PLANNER = 'PLANNER',
  VIEWER = 'VIEWER',
}

export const Roles = (...roles: Role[]) =>
  SetMetadata(ROLES_KEY, roles);
