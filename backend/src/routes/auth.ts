import express, { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../prisma/client"; // 프로젝트 구조에 맞게 경로 조정
import jwt from "jsonwebtoken";

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET; // 실제 환경변수로 설정하세요

// GET /api/auth/config - OAuth 설정 정보 제공
router.get("/auth/config", (req: Request, res: Response) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  });
});

// POST /api/auth/google
router.post("/auth/google", async (req: Request, res: Response) => {
  console.log("✅ [POST] /api/auth/google 진입");
  const { token } = req.body; // 프론트에서 넘긴 구글 id_token

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // 1) 구글 id_token 검증
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const googleId = payload.sub;
    const now = new Date();

    // 2) DB 내 기존 사용자 조회
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // 신규 가입
      user = await prisma.user.create({
        data: {
          googleId,
          nickname: payload.name || "Anonymous",
          profileImageUrl: payload.picture,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        },
      });
    } else {
      // 기존 로그인 -> 마지막 로그인 시간 업데이트
      user = await prisma.user.update({
        where: { googleId },
        data: { lastLoginAt: now, updatedAt: now },
      });
    }

    // 3) 자체 JWT 토큰 생성 (payload에 googleId 필드를 넣음)
    const appToken = jwt.sign(
      {
        userId: user.id,
        googleId: user.googleId,      // 기존 sub 대신 googleId 사용
        nickname: user.nickname,
      },
      JWT_SECRET,
      { expiresIn: "1d" } // 토큰 만료 기간
    );

    // 4) 클라이언트에 JWT 및 유저정보 응답
    res.json({
      token: appToken,
      user: {
        id: user.id,
        googleId: user.googleId,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// GET /api/userinfo
router.get('/userinfo', async (req: Request, res: Response) => {
  try {
    // 1) Authorization 헤더에서 토큰 빼오기
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1]; // Bearer 토큰 분리
    if (!token) return res.status(401).json({ message: 'Malformed token' });

    // 2) 자체 JWT 비밀키로 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // 3) JWT 페이로드 내 googleId로 DB 조회
    const googleId = decoded.googleId;  // sub가 아니라 googleId 필드 사용
    if (!googleId) return res.status(400).json({ message: 'No googleId in token' });

    // 4) DB에서 googleId 기준으로 User 찾기 (Prisma 사용)
    const user = await prisma.user.findUnique({ where: { googleId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 5) 유저 정보를 프론트로 반환 (필요한 필드만)
    res.json({ user: {
      id: user.id,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      lastLoginAt: user.lastLoginAt,
      rating_mu: user.rating_mu,
      rating_sigma: user.rating_sigma,
      totalGames: (user as any).totalGames || 0,
      wins: (user as any).wins || 0,
      draws: (user as any).draws || 0,
      losses: (user as any).losses || 0,
      // 필요 시 더 추가 가능
    }});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 에러' });
  }
});

// GET /api/ranking - 유저 랭킹 조회 (rating_mu 기준 상위 10명)
router.get('/ranking', async (req: Request, res: Response) => {
  try {
    // rating_mu 기준으로 상위 10명 조회
    const topUsers = await prisma.user.findMany({
      orderBy: {
        rating_mu: 'desc'
      },
      take: 10
    });

    // 랭킹 정보와 함께 반환
    const ranking = topUsers.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      rating_mu: user.rating_mu,
      rating_sigma: user.rating_sigma,
      totalGames: (user as any).totalGames || 0,
      wins: (user as any).wins || 0,
      draws: (user as any).draws || 0,
      losses: (user as any).losses || 0
    }));

    res.json({ ranking });
  } catch (err) {
    console.error('랭킹 조회 오류:', err);
    res.status(500).json({ message: '랭킹 조회에 실패했습니다.' });
  }
});

// GET /api/user/games - 유저 전적 조회
router.get('/user/games', async (req: Request, res: Response) => {
  try {
    // 1) Authorization 헤더에서 토큰 빼오기
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1]; // Bearer 토큰 분리
    if (!token) return res.status(401).json({ message: 'Malformed token' });

    // 2) JWT 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const userId = decoded.userId;
    if (!userId) return res.status(400).json({ message: 'No userId in token' });

    // 3) 유저 정보에서 참여한 게임 ID 목록 가져오기
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { participatedGameIds: true } as any
    });

    if (!user || !(user as any).participatedGameIds || (user as any).participatedGameIds.length === 0) {
      return res.json({
        user: await prisma.user.findUnique({ where: { id: userId } }),
        games: []
      });
    }

    // 4) 최근 20게임 ID만 가져오기 (배열의 마지막 20개)
    const recentGameIds = (user as any).participatedGameIds.slice(-20);

    // 5) 해당 게임들의 상세 정보 조회
    const userGames = await (prisma as any).game.findMany({
      where: {
        id: { in: recentGameIds }
      },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        playedAt: 'desc'
      }
    });

    // 6) 전적 데이터 가공
    const gameHistory = userGames.map((game: any) => {
      const allPlayers = game.players.sort((a: any, b: any) => a.rank - b.rank);
      
      // 현재 유저의 게임 정보 찾기
      const myGameData = allPlayers.find((player: any) => player.userId === userId);
      
      // 게임 소요 시간 계산 (실제 게임 로직에 따라 조정 필요)
      const gameDuration = Math.floor(Math.random() * 1800) + 300; // 5분~35분 랜덤 (임시)
      
      return {
        gameId: game.gameId,
        playedAt: game.playedAt,
        playerCount: game.playerCount,
        roomTitle: game.roomTitle, // 방 이름 추가
        duration: gameDuration, // 초 단위
        myRank: myGameData?.rank || 0,
        myScore: myGameData?.score || 0,
        myRatingChange: myGameData?.rating_mu_change || 0,
        myRatingBefore: myGameData?.rating_mu_before || 0,
        myRatingAfter: myGameData?.rating_mu_after || 0,
        players: allPlayers.map((player: any) => ({
          userId: player.userId,
          nickname: player.nickname, // 게임 당시 저장된 닉네임 사용
          profileImageUrl: player.user.profileImageUrl,
          rank: player.rank,
          score: player.score,
          ratingChange: player.rating_mu_change,
          ratingBefore: player.rating_mu_before,
          ratingAfter: player.rating_mu_after
        }))
      };
    });

    // 7) 유저 통계 정보도 함께 반환
    const userInfo = await prisma.user.findUnique({
      where: { id: userId }
    });

    res.json({
      user: userInfo,
      games: gameHistory
    });

  } catch (err) {
    console.error('전적 조회 오류:', err);
    res.status(500).json({ message: '전적 조회에 실패했습니다.' });
  }
});

// GET /api/user/games/:userId - 특정 유저의 전적 조회
router.get('/user/games/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const targetUserId = parseInt(userId);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // 1) Authorization 헤더에서 토큰 빼오기 (요청자 인증용)
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Malformed token' });

    // 2) JWT 토큰 검증 (요청자 인증)
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // 3) 대상 유저가 존재하는지 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 4) 대상 유저의 참여한 게임 ID 목록 가져오기
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { participatedGameIds: true } as any
    });

    if (!user || !(user as any).participatedGameIds || (user as any).participatedGameIds.length === 0) {
      return res.json({
        user: targetUser,
        games: []
      });
    }

    // 5) 최근 20게임 ID만 가져오기
    const recentGameIds = (user as any).participatedGameIds.slice(-20);

    // 6) 해당 게임들의 상세 정보 조회
    const userGames = await (prisma as any).game.findMany({
      where: {
        id: { in: recentGameIds }
      },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        playedAt: 'desc'
      }
    });

    // 7) 전적 데이터 가공
    const gameHistory = userGames.map((game: any) => {
      const allPlayers = game.players.sort((a: any, b: any) => a.rank - b.rank);
      
      // 대상 유저의 게임 정보 찾기
      const targetUserGameData = allPlayers.find((player: any) => player.userId === targetUserId);
      
      // 게임 소요 시간 계산 (실제 게임 로직에 따라 조정 필요)
      const gameDuration = Math.floor(Math.random() * 1800) + 300; // 5분~35분 랜덤 (임시)
      
      return {
        gameId: game.gameId,
        playedAt: game.playedAt,
        playerCount: game.playerCount,
        roomTitle: game.roomTitle,
        duration: gameDuration,
        myRank: targetUserGameData?.rank || 0,
        myScore: targetUserGameData?.score || 0,
        myRatingChange: targetUserGameData?.rating_mu_change || 0,
        myRatingBefore: targetUserGameData?.rating_mu_before || 0,
        myRatingAfter: targetUserGameData?.rating_mu_after || 0,
        players: allPlayers.map((player: any) => ({
          userId: player.userId,
          nickname: player.nickname,
          profileImageUrl: player.user.profileImageUrl,
          rank: player.rank,
          score: player.score,
          ratingChange: player.rating_mu_change,
          ratingBefore: player.rating_mu_before,
          ratingAfter: player.rating_mu_after
        }))
      };
    });

    res.json({
      user: targetUser,
      games: gameHistory
    });

  } catch (err) {
    console.error('유저 전적 조회 오류:', err);
    res.status(500).json({ message: '유저 전적 조회에 실패했습니다.' });
  }
});

export default router;
