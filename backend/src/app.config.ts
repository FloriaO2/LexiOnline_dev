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

    // CORS 설정: 프론트엔드 주소에 맞게 origin 변경하세요
    app.use(cors({
      origin: "http://localhost:3000",  // 프론트엔드 주소(포트 포함)
      credentials: true,                 // 쿠키나 인증 헤더 사용 시 true
    }));

    // JSON 바디 파싱 미들웨어
    app.use(express.json());

    // API 라우터 등록
    app.use('/api', authRouter);

    // 테스트용 라우트
    app.get("/hello_world", (req, res) => {
      res.send("It's time to kick ass and chew bubblegum!");
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
