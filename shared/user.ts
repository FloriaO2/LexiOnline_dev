// shared/user.ts
export interface User {
  id: number;
  googleId: string;
  nickname: string;
  profileImageUrl?: string;
  rating_mu: number;
  rating_sigma: number;
}