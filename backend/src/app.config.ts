import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";

import { MyRoom } from "./rooms/MyRoom";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('my_room', MyRoom);
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
