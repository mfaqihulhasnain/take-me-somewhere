-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'SUSPECT', 'DEAD');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('APPROVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('DEAD', 'INAPPROPRIATE');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "categoryId" TEXT NOT NULL,
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "editorialScore" INTEGER NOT NULL DEFAULT 3,
    "weirdness" INTEGER NOT NULL DEFAULT 3,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastHttpStatus" INTEGER,
    "lastFailureReason" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationVote" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "value" "VoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationReport" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DestinationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_url_key" ON "Destination"("url");

-- CreateIndex
CREATE INDEX "Destination_categoryId_healthStatus_moderationStatus_isNsfw_idx" ON "Destination"("categoryId", "healthStatus", "moderationStatus", "isNsfw");

-- CreateIndex
CREATE INDEX "Destination_lastCheckedAt_idx" ON "Destination"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "Destination_reportCount_idx" ON "Destination"("reportCount");

-- CreateIndex
CREATE INDEX "DestinationVote_sessionHash_idx" ON "DestinationVote"("sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "DestinationVote_destinationId_sessionHash_key" ON "DestinationVote"("destinationId", "sessionHash");

-- CreateIndex
CREATE INDEX "DestinationReport_sessionHash_idx" ON "DestinationReport"("sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "DestinationReport_destinationId_sessionHash_key" ON "DestinationReport"("destinationId", "sessionHash");

-- AddForeignKey
ALTER TABLE "Destination" ADD CONSTRAINT "Destination_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationVote" ADD CONSTRAINT "DestinationVote_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinationReport" ADD CONSTRAINT "DestinationReport_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

