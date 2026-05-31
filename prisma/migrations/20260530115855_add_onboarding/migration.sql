-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_VIDEO', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "declinedOnboardingBefore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'ACCEPTED';

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "onboardingKinescopeId" TEXT,
    "onboardingTitle" TEXT NOT NULL DEFAULT 'Добро пожаловать в команду',
    "onboardingText" TEXT NOT NULL DEFAULT 'Посмотрите обращение основателя и подтвердите, что разделяете наши ценности.',
    "declineMessage" TEXT NOT NULL DEFAULT 'Спасибо за честность! Если передумаете — нажмите «Попробовать снова».',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
