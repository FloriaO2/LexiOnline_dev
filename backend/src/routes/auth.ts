import express, { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../prisma/client"; // 프로젝트 구조에 맞게 경로 조정
import jwt from "jsonwebtoken";

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET; // 실제 환경변수로 설정하세요

// 환경 변수 검증
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error("❌ GOOGLE_CLIENT_ID 환경 변수가 설정되지 않았습니다!");
}
if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET 환경 변수가 설정되지 않았습니다!");
}

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
    console.log(`[Auth] 데이터베이스 조회 시도: googleId=${googleId}`);
    let user;
    try {
      user = await prisma.user.findUnique({ where: { googleId } });
      console.log(`[Auth] 데이터베이스 조회 성공: user=${user ? 'found' : 'not found'}`);
    } catch (dbError) {
      console.error("❌ 데이터베이스 조회 오류:", dbError);
      throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    if (!user) {
      // 신규 가입
      console.log(`[Auth] 신규 사용자 생성 시도: googleId=${googleId}, nickname=${payload.name}`);
      try {
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
        console.log(`[Auth] 신규 사용자 생성 성공: userId=${user.id}`);
      } catch (createError) {
        console.error("❌ 사용자 생성 오류:", createError);
        throw new Error(`User creation failed: ${createError instanceof Error ? createError.message : String(createError)}`);
      }
    } else {
      // 기존 로그인 -> 마지막 로그인 시간 업데이트
      console.log(`[Auth] 기존 사용자 업데이트 시도: userId=${user.id}`);
      try {
        user = await prisma.user.update({
          where: { googleId },
          data: { lastLoginAt: now, updatedAt: now },
        });
        console.log(`[Auth] 사용자 업데이트 성공: userId=${user.id}`);
      } catch (updateError) {
        console.error("❌ 사용자 업데이트 오류:", updateError);
        throw new Error(`User update failed: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
      }
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
    console.error("❌ Google auth error:", err);
    console.error("Error details:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
    });
    
    // JWT_SECRET 확인
    if (!JWT_SECRET) {
      console.error("❌ JWT_SECRET이 설정되지 않았습니다!");
    }
    
    res.status(500).json({ 
      error: "Authentication failed",
      details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : undefined
    });
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
      result_wins: (user as any).result_wins || 0,
      result_draws: (user as any).result_draws || 0,
      result_losses: (user as any).result_losses || 0,
      allowGameHistoryView: (user as any).allowGameHistoryView !== undefined ? (user as any).allowGameHistoryView : true,
      // 필요 시 더 추가 가능
    }});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 에러' });
  }
});

// GET /api/ranking - 유저 랭킹 조회 (게임 경험자 우선, rating_mu 기준)
router.get('/ranking', async (req: Request, res: Response) => {
  try {
    // 1) 게임 경험이 있는 유저들만 rating_mu 기준으로 조회 (순위가 없는 유저는 제외)
    const experiencedUsers = await prisma.user.findMany({
      where: {
        totalGames: {
          gt: 0
        }
      },
      orderBy: {
        rating_mu: 'desc'
      },
      take: 10
    });

    // 2) 게임 경험자들의 랭킹 계산
    const ranking = experiencedUsers.map((user, index) => {
      const totalGames = (user as any).totalGames || 0;
      
      let rank = index + 1;
      
      // 동점자인지 확인 (이전 유저와 rating_mu가 같은 경우)
      if (index > 0 && user.rating_mu === experiencedUsers[index - 1].rating_mu) {
        // 이전 유저의 랭크를 찾아서 동일하게 설정
        for (let i = index - 1; i >= 0; i--) {
          if (experiencedUsers[i].rating_mu !== user.rating_mu) {
            break;
          }
          rank = i + 1;
        }
      }
      
      return {
        rank,
        id: user.id,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        rating_mu: user.rating_mu,
        rating_sigma: user.rating_sigma,
        totalGames,
        result_wins: (user as any).result_wins || 0,
        result_draws: (user as any).result_draws || 0,
        result_losses: (user as any).result_losses || 0
      };
    });

    res.json({ ranking });
  } catch (err) {
    console.error('랭킹 조회 오류:', err);
    res.status(500).json({ message: '랭킹 조회에 실패했습니다.' });
  }
});

// GET /api/user/ranking - 특정 사용자의 순위 조회
router.get('/user/ranking', async (req: Request, res: Response) => {
  try {
    // Authorization 헤더에서 토큰 빼오기
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Malformed token' });

    // JWT 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const googleId = decoded.googleId;
    if (!googleId) return res.status(400).json({ message: 'No googleId in token' });

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({ where: { googleId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const totalGames = (user as any).totalGames || 0;
    
    // 게임 기록이 없는 경우 순위를 "-"로 설정
    if (totalGames === 0) {
      return res.json({ 
        rank: "-",
        totalUsers: 0,
        user: {
          id: user.id,
          nickname: user.nickname,
          profileImageUrl: user.profileImageUrl,
          rating_mu: user.rating_mu,
          rating_sigma: user.rating_sigma,
          totalGames: 0,
          wins: 0,
          draws: 0,
          losses: 0
        }
      });
    }

    // 전체 사용자 수 조회 (순위 계산용)
    const totalUsers = await prisma.user.count();
    
    // 현재 사용자보다 높은 rating_mu를 가진 사용자 수 계산
    const higherRatedUsers = await prisma.user.count({
      where: {
        rating_mu: {
          gt: user.rating_mu
        }
      }
    });

    // 동일한 rating_mu를 가진 사용자들 중에서 더 높은 순위인지 확인
    const sameRatingUsers = await prisma.user.findMany({
      where: {
        rating_mu: user.rating_mu
      },
      orderBy: {
        id: 'asc' // ID 기준으로 정렬하여 일관된 순위 계산
      }
    });

    const userIndexInSameRating = sameRatingUsers.findIndex(u => u.id === user.id);
    const rank = higherRatedUsers + userIndexInSameRating + 1;

    res.json({ 
      rank,
      totalUsers,
      user: {
        id: user.id,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        rating_mu: user.rating_mu,
        rating_sigma: user.rating_sigma,
        totalGames: (user as any).totalGames || 0,
        result_wins: (user as any).result_wins || 0,
        result_draws: (user as any).result_draws || 0,
        result_losses: (user as any).result_losses || 0
      }
    });
  } catch (err) {
    console.error('사용자 순위 조회 오류:', err);
    res.status(500).json({ message: '사용자 순위 조회에 실패했습니다.' });
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

    // 5) 해당 게임들의 상세 정보 조회 (새로운 Game 구조 사용)
    const userGames = await (prisma as any).game.findMany({
      where: {
        id: { in: recentGameIds }
      },
      orderBy: {
        playedAt: 'desc'
      }
    });

    // 6) 모든 게임에서 등장하는 유저 ID 수집
    const allUserIds = new Set<number>();
    userGames.forEach((game: any) => {
      for (let i = 1; i <= 5; i++) {
        const userIdField = `player${i}_userId`;
        if (game[userIdField]) {
          allUserIds.add(game[userIdField]);
        }
      }
    });

    // 7) 한 번에 모든 유저의 프로필 이미지 조회 (배치 쿼리)
    const userProfiles = await prisma.user.findMany({
      where: {
        id: { in: Array.from(allUserIds) }
      },
      select: {
        id: true,
        profileImageUrl: true
      }
    });

    // 8) userId -> profileImageUrl 매핑 생성
    const profileMap = new Map<number, string | null>();
    userProfiles.forEach(user => {
      profileMap.set(user.id, user.profileImageUrl);
    });

    // 9) 전적 데이터 가공 (새로운 Game 구조 사용)
    const gameHistory = userGames.map((game: any) => {
      // 게임에서 플레이어 정보 추출
      const players = [];
      
      // player1부터 player5까지 확인
      for (let i = 1; i <= 5; i++) {
        const userIdField = `player${i}_userId`;
        const nicknameField = `player${i}_nickname`;
        const rankField = `player${i}_rank`;
        const scoreField = `player${i}_score`;
        const ratingChangeField = `player${i}_rating_mu_change`;
        
        if (game[userIdField]) {
          players.push({
            userId: game[userIdField],
            nickname: game[nicknameField],
            rank: game[rankField],
            score: game[scoreField],
            ratingChange: game[ratingChangeField],
            profileImageUrl: profileMap.get(game[userIdField]) || null // 미리 조회한 프로필 이미지 사용
          });
        }
      }
      
      // 순위별로 정렬
      const allPlayers = players.sort((a, b) => a.rank - b.rank);
      
      // 현재 유저의 게임 정보 찾기
      const myGameData = allPlayers.find((player: any) => player.userId === userId);
      
      // 실제 게임 소요 시간 사용 (데이터베이스에 저장된 값)
      const gameDuration = game.duration || 0; // 초 단위
      
      return {
        gameId: game.gameId,
        playedAt: game.playedAt,
        playerCount: game.playerCount,
        roomTitle: game.roomTitle, // 방 이름 추가
        duration: gameDuration, // 초 단위
        myRank: myGameData?.rank || 0,
        myScore: myGameData?.score || 0,
        myRatingChange: myGameData?.ratingChange || 0,
        players: allPlayers.map((player: any) => ({
          userId: player.userId,
          nickname: player.nickname, // 게임 당시 저장된 닉네임 사용
          profileImageUrl: player.profileImageUrl, // 배치 조회한 프로필 이미지 사용
          rank: player.rank,
          score: player.score,
          ratingChange: player.ratingChange
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

// PUT /api/user/privacy-settings - 전적 공개 설정 변경
router.put('/user/privacy-settings', async (req: Request, res: Response) => {
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

    // 3) 요청 본문에서 설정값 가져오기
    const { allowGameHistoryView } = req.body;
    if (typeof allowGameHistoryView !== 'boolean') {
      return res.status(400).json({ message: 'allowGameHistoryView must be a boolean' });
    }

    // 4) 유저 설정 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        allowGameHistoryView,
        updatedAt: new Date()
      } as any
    });

    res.json({ 
      message: 'Privacy settings updated successfully',
      allowGameHistoryView: (updatedUser as any).allowGameHistoryView 
    });

  } catch (err) {
    console.error('프라이버시 설정 업데이트 오류:', err);
    res.status(500).json({ message: '프라이버시 설정 업데이트에 실패했습니다.' });
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

    // 3) 대상 유저가 존재하는지 확인 및 전적 공개 설정 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 4) 요청자 정보 조회
    const requestorUserId = decoded.userId;
    const requestor = await prisma.user.findUnique({
      where: { id: requestorUserId }
    });

    if (!requestor) {
      return res.status(404).json({ message: 'Requestor not found' });
    }

    // 5) 전적 공개 설정 확인 (본인이 아닌 경우에만)
    if (requestorUserId !== targetUserId && !(targetUser as any).allowGameHistoryView) {
      // 랭킹탭에서 들어온 경우인지 확인
      const isFromRanking = req.query.fromRanking === 'true';
      
      // 랭킹탭에서 들어온 경우 무조건 실제 유저 정보 반환
      if (isFromRanking) {
        return res.json({
          user: {
            id: targetUser.id,
            nickname: targetUser.nickname, // 실제 닉네임
            profileImageUrl: targetUser.profileImageUrl, // 실제 프로필 이미지
            rating_mu: targetUser.rating_mu, // 실제 레이팅
            totalGames: (targetUser as any).totalGames || 0,
            result_wins: (targetUser as any).result_wins || 0,
            result_draws: (targetUser as any).result_draws || 0,
            result_losses: (targetUser as any).result_losses || 0,
            allowGameHistoryView: false
          },
          games: [],
          message: '전적 공개를 허용하지 않았습니다.'
        });
      }
      
      // 요청자와 대상 유저가 함께 플레이한 게임이 있는지 확인
      const requestorGameIds = (requestor as any).participatedGameIds || [];
      const targetGameIds = (targetUser as any).participatedGameIds || [];
      const sharedGameIds = requestorGameIds.filter((id: number) => targetGameIds.includes(id));
      
      // 함께 플레이한 게임이 있는 경우 (내 전적에서 다른 플레이어를 클릭한 경우)
      if (sharedGameIds.length > 0) {
        // 함께 플레이했던 게임에서의 닉네임 찾기
        let gameNickname = targetUser.nickname; // 기본값은 현재 닉네임
        
        try {
          // 요청자와 대상 유저가 함께 플레이한 게임 찾기 (새로운 구조 사용)
          const sharedGame = await (prisma as any).game.findFirst({
            where: {
              id: { in: sharedGameIds }
            },
            orderBy: {
              playedAt: 'desc'
            }
          });
          
          if (sharedGame) {
            // player1부터 player5까지 확인하여 대상 유저의 닉네임 찾기
            for (let i = 1; i <= 5; i++) {
              const userIdField = `player${i}_userId`;
              const nicknameField = `player${i}_nickname`;
              
              if (sharedGame[userIdField] === targetUserId) {
                gameNickname = sharedGame[nicknameField];
                break;
              }
            }
          }
        } catch (err) {
          console.error('게임 닉네임 조회 오류:', err);
          // 오류가 발생해도 기본 닉네임 사용
        }
        
        return res.json({
          user: {
            id: targetUser.id,
            nickname: gameNickname, // 함께 플레이했던 게임에서의 닉네임
            profileImageUrl: null, // 프로필 이미지는 null로 설정
            rating_mu: null, // 레이팅은 null로 설정
            allowGameHistoryView: false
          },
          games: [],
          message: '전적 공개를 허용하지 않았습니다.'
        });
      } else {
        // 함께 플레이한 게임이 없는 경우 (랭킹탭에서 들어온 경우)
        // 실제 유저 정보를 반환하되 게임 기록은 비공개
        return res.json({
          user: {
            id: targetUser.id,
            nickname: targetUser.nickname, // 실제 닉네임
            profileImageUrl: targetUser.profileImageUrl, // 실제 프로필 이미지
            rating_mu: targetUser.rating_mu, // 실제 레이팅
            totalGames: (targetUser as any).totalGames || 0,
            result_wins: (targetUser as any).result_wins || 0,
            result_draws: (targetUser as any).result_draws || 0,
            result_losses: (targetUser as any).result_losses || 0,
            allowGameHistoryView: false
          },
          games: [],
          message: '전적 공개를 허용하지 않았습니다.'
        });
      }
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

    // 6) 해당 게임들의 상세 정보 조회 (새로운 Game 구조 사용)
    const userGames = await (prisma as any).game.findMany({
      where: {
        id: { in: recentGameIds }
      },
      orderBy: {
        playedAt: 'desc'
      }
    });

    // 7) 모든 게임에서 등장하는 유저 ID 수집
    const allUserIds = new Set<number>();
    userGames.forEach((game: any) => {
      for (let i = 1; i <= 5; i++) {
        const userIdField = `player${i}_userId`;
        if (game[userIdField]) {
          allUserIds.add(game[userIdField]);
        }
      }
    });

    // 8) 한 번에 모든 유저의 프로필 이미지 조회 (배치 쿼리)
    const userProfiles = await prisma.user.findMany({
      where: {
        id: { in: Array.from(allUserIds) }
      },
      select: {
        id: true,
        profileImageUrl: true
      }
    });

    // 9) userId -> profileImageUrl 매핑 생성
    const profileMap = new Map<number, string | null>();
    userProfiles.forEach(user => {
      profileMap.set(user.id, user.profileImageUrl);
    });

    // 10) 전적 데이터 가공 (새로운 Game 구조 사용)
    const gameHistory = userGames.map((game: any) => {
      // 게임에서 플레이어 정보 추출
      const players = [];
      
      // player1부터 player5까지 확인
      for (let i = 1; i <= 5; i++) {
        const userIdField = `player${i}_userId`;
        const nicknameField = `player${i}_nickname`;
        const rankField = `player${i}_rank`;
        const scoreField = `player${i}_score`;
        const ratingChangeField = `player${i}_rating_mu_change`;
        
        if (game[userIdField]) {
          players.push({
            userId: game[userIdField],
            nickname: game[nicknameField],
            rank: game[rankField],
            score: game[scoreField],
            ratingChange: game[ratingChangeField],
            profileImageUrl: profileMap.get(game[userIdField]) || null // 미리 조회한 프로필 이미지 사용
          });
        }
      }
      
      // 순위별로 정렬
      const allPlayers = players.sort((a, b) => a.rank - b.rank);
      
      // 대상 유저의 게임 정보 찾기
      const targetUserGameData = allPlayers.find((player: any) => player.userId === targetUserId);
      
      // 실제 게임 소요 시간 사용 (데이터베이스에 저장된 값)
      const gameDuration = game.duration || 0; // 초 단위
      
      return {
        gameId: game.gameId,
        playedAt: game.playedAt,
        playerCount: game.playerCount,
        roomTitle: game.roomTitle,
        duration: gameDuration,
        myRank: targetUserGameData?.rank || 0,
        myScore: targetUserGameData?.score || 0,
        myRatingChange: targetUserGameData?.ratingChange || 0,
        players: allPlayers.map((player: any) => ({
          userId: player.userId,
          nickname: player.nickname, // 게임 당시 저장된 닉네임 사용
          profileImageUrl: player.profileImageUrl, // 배치 조회한 프로필 이미지 사용
          rank: player.rank,
          score: player.score,
          ratingChange: player.ratingChange
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
