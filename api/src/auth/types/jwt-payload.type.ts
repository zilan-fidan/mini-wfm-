export type JwtPayload = {
  id: number;
  username: string;
  role: 'ADMIN' | 'PLANNER' | 'VIEWER';
};