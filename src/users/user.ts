export type Role = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  role: Role;
}
