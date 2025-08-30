-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "googleId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "rating_mu" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    "rating_sigma" DOUBLE PRECISION NOT NULL DEFAULT 8.333,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "playCount_3p" INTEGER NOT NULL DEFAULT 0,
    "playCount_4p" INTEGER NOT NULL DEFAULT 0,
    "playCount_5p" INTEGER NOT NULL DEFAULT 0,
    "wins_3p" INTEGER NOT NULL DEFAULT 0,
    "second_3p" INTEGER NOT NULL DEFAULT 0,
    "third_3p" INTEGER NOT NULL DEFAULT 0,
    "wins_4p" INTEGER NOT NULL DEFAULT 0,
    "second_4p" INTEGER NOT NULL DEFAULT 0,
    "third_4p" INTEGER NOT NULL DEFAULT 0,
    "fourth_4p" INTEGER NOT NULL DEFAULT 0,
    "wins_5p" INTEGER NOT NULL DEFAULT 0,
    "second_5p" INTEGER NOT NULL DEFAULT 0,
    "third_5p" INTEGER NOT NULL DEFAULT 0,
    "fourth_5p" INTEGER NOT NULL DEFAULT 0,
    "fifth_5p" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerCount" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "scoresAll" JSONB NOT NULL,
    "rating_mu_before" DOUBLE PRECISION NOT NULL,
    "rating_sigma_before" DOUBLE PRECISION NOT NULL,
    "rating_mu_after" DOUBLE PRECISION NOT NULL,
    "rating_sigma_after" DOUBLE PRECISION NOT NULL,
    "gameId" TEXT,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "GameHistory_userId_idx" ON "GameHistory"("userId");

-- CreateIndex
CREATE INDEX "GameHistory_gameId_idx" ON "GameHistory"("gameId");

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
