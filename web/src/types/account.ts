import type { Role } from './auth';

export type Account = {
  id: number;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountPayload = {
  username: string;
  password: string;
  role: Role;
};
