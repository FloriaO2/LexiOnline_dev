// shared/models/User.ts
import { GameHistory } from './GameHistory';

export interface User {
  id: number;
  googleId: string;
  nickname: string;
  profileImageUrl?: string;
  rating_mu: number;
  rating_sigma: number;
  createdAt: string; // DateTime을 문자열 ISO 형식으로 받는 경우
  updatedAt: string;
  lastLoginAt?: string;
  
  playCount_3p: number;
  playCount_4p: number;
  playCount_5p: number;
  
  wins_3p: number;
  second_3p: number;
  third_3p: number;
  wins_4p: number;
  second_4p: number;
  third_4p: number;
  fourth_4p: number;
  wins_5p: number;
  second_5p: number;
  third_5p: number;
  fourth_5p: number;
  fifth_5p: number;

  gameHistories: GameHistory[];
}