/*
  Warnings:

  - You are about to drop the column `lastLogin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `loginType` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "lastLogin",
DROP COLUMN "loginType",
ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profilePic" TEXT,
ADD COLUMN     "registerCode" TEXT,
ADD COLUMN     "registerCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "registerCodeToken" TEXT,
ADD COLUMN     "resetPasswordCode" TEXT,
ADD COLUMN     "resetPasswordCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "resetPasswordCodeToken" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "name" DROP NOT NULL;

-- DropEnum
DROP TYPE "LoginType";
