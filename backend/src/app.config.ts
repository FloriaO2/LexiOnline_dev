import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import { matchMaker } from "colyseus";

import { MyRoom } from "./rooms/MyRoom";

// gameServer를 전역으로 저장
let globalGameServer: any = null;

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('my_room', MyRoom);
    globalGameServer = gameServer; // 전역 변수에 저장
  },

  initializeExpress: (app) => {
    // 모든 요청 로깅용 전역 미들웨어 추가
    app.use((req, res, next) => {
      console.log(`[Express REQUEST] ${req.method} ${req.url}`);
      next();
    });

    // CORS 설정: 개발/프로덕션 환경 모두 지원
    app.use(cors({
      origin: [
        "http://localhost:3000",           // 개발 환경
        "https://lexionline-dev.vercel.app" // 프로덕션 환경
      ],
      credentials: true,                 // 쿠키나 인증 헤더 사용 시 true
    }));

    // JSON 바디 파싱 미들웨어
    app.use(express.json());

    // API 라우터 등록
    app.use('/api', authRouter);
    
    // 공개방 목록 조회 API
    app.get('/api/rooms', async (req, res) => {
      try {
        // Colyseus 게임 서버에서 활성화된 방 목록 가져오기
        if (!globalGameServer) {
          console.error('Game server not available');
          return res.status(500).json({ error: 'Game server not available' });
        }

        console.log('Game server found, querying rooms...');
        console.log('Game server structure:', Object.keys(globalGameServer));
        console.log('MatchMaker imported:', !!matchMaker);
        console.log('MatchMaker structure:', matchMaker ? Object.keys(matchMaker) : 'No matchMaker');
        
        // 모든 방을 조회하기 위해 다양한 방법 시도
        let rooms = [];
        try {
          // 방법 1: matchMaker.query()에 빈 조건으로 모든 방 조회
          if (matchMaker && matchMaker.query) {
            console.log('Trying matchMaker.query({})...');
            rooms = await matchMaker.query({});
            console.log('matchMaker.query({}) result:', rooms.length, 'rooms');
          } else {
            console.log('matchMaker.query not available');
          }
          
          // 방법 2: matchMaker의 다른 메서드들 시도
          if (rooms.length === 0 && matchMaker) {
            console.log('Available matchMaker methods:', Object.keys(matchMaker));
            
            // 방법 3: 직접 rooms 속성 접근 시도
            if (globalGameServer.rooms) {
              console.log('Trying globalGameServer.rooms...');
              rooms = Object.values(globalGameServer.rooms);
              console.log('globalGameServer.rooms result:', rooms.length, 'rooms');
            }
            
            // 방법 4: matchMaker의 다른 메서드들 시도
            if (rooms.length === 0) {
              console.log('Trying alternative methods...');
              // matchMaker의 다른 메서드들 확인
              if (matchMaker.rooms) {
                rooms = Object.values(matchMaker.rooms);
                console.log('matchMaker.rooms result:', rooms.length, 'rooms');
              }
            }
          }
        } catch (queryError) {
          console.log('Query method failed:', queryError instanceof Error ? queryError.message : String(queryError));
          rooms = [];
        }
        
        console.log('Total rooms found:', rooms.length);
        
        // 방 목록을 로그로 출력하여 디버깅
        console.log('=== ALL ROOMS DEBUG ===');
        rooms.forEach((room: any, index: number) => {
          console.log(`Room ${index}:`, {
            roomId: room.roomId,
            metadata: room.metadata,
            clients: room.clients,
            maxClients: room.maxClients,
            name: room.name
          });
        });
        console.log('=== END ROOMS DEBUG ===');
        
        // 공개방과 비밀방 모두 표시 (코드 입력 방식 제외)
        const availableRooms = rooms
          .filter((room: any) => {
            // 공개방과 비밀방만 필터링 (roomType이 "public" 또는 "private"인 방)
            const roomType = room.metadata && room.metadata.roomType;
            const isAvailable = roomType === 'public' || roomType === 'private';
            console.log(`Room ${room.roomId}: metadata=`, room.metadata, 'roomType=', roomType, 'isAvailable=', isAvailable);
            
            return isAvailable;
          })
          .map((room: any) => ({
            roomId: room.roomId,
            title: room.metadata?.roomTitle || 'Untitled Room',
            roomType: room.metadata?.roomType || 'public',
            playerCount: room.clients,
            maxClients: room.maxClients,
            createdAt: room.createdAt
          }))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        console.log('Available rooms found:', availableRooms.length);
        
        res.json({ rooms: availableRooms });
      } catch (error) {
        console.error('Error fetching public rooms:', error);
        res.status(500).json({ error: 'Failed to fetch rooms', details: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // 루트 경로 라우트
    app.get("/", (req, res) => {
      res.json({
        message: "LexiOnline Backend API",
        status: "running",
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: "/api/auth",
          hello: "/hello_world",
          monitor: "/monitor"
        }
      });
    });

    // 테스트용 라우트
    app.get("/hello_world", (req, res) => {
      res.send("TEST");
    });

    // Playground 및 Monitor (비프로덕션)
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground());
    }
    app.use("/monitor", monitor());
  },

  beforeListen: () => {
    // Listen 전 작업이 필요하면 여기에 작성
  }
});
