export type Role = 'ADMIN' | 'PLANNER' | 'VIEWER';

export type AuthUser = {
  id: number;
  username: string;
  role: Role;
};

export type LoginPayload = {
  username: string;
  password: string;
};

// POST /auth/login cevabı
export type LoginResponse = {
  accessToken: string;
  expiresIn: number; // saniye
  user: AuthUser;
};
