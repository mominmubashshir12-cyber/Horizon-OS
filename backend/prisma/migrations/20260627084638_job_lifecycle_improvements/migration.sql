/*
  Warnings:

  - You are about to drop the `ConsumableMaterial` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `assignedToId` on the `JobCard` table. All the data in the column will be lost.
  - You are about to drop the column `materialId` on the `MaterialUsageLog` table. All the data in the column will be lost.
  - Added the required column `productId` to the `MaterialUsageLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ConsumableMaterial_materialCode_key";

-- AlterTable
ALTER TABLE "SiteVisit" ADD COLUMN "clientUpdatedAt" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ConsumableMaterial";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "JobRequiredTool" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobCardId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    CONSTRAINT "JobRequiredTool_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobRequiredTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobRequiredMaterial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobCardId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    CONSTRAINT "JobRequiredMaterial_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobRequiredMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestedJobId" INTEGER,
    "assignedJobId" INTEGER,
    "userId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobRequest_requestedJobId_fkey" FOREIGN KEY ("requestedJobId") REFERENCES "JobCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobRequest_assignedJobId_fkey" FOREIGN KEY ("assignedJobId") REFERENCES "JobCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JobRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobCardId" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenById" INTEGER NOT NULL,
    CONSTRAINT "JobPhoto_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobPhoto_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddonRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobCardId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AddonRequest_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AddonRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddonRequestTool" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "addonRequestId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "AddonRequestTool_addonRequestId_fkey" FOREIGN KEY ("addonRequestId") REFERENCES "AddonRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AddonRequestTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddonRequestMaterial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "addonRequestId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantityRequested" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "AddonRequestMaterial_addonRequestId_fkey" FOREIGN KEY ("addonRequestId") REFERENCES "AddonRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AddonRequestMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolTransferRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "toolId" INTEGER NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "jobCardId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "receivedCondition" TEXT,
    "note" TEXT,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientUpdatedAt" DATETIME,
    CONSTRAINT "ToolTransferRequest_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ToolTransferRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ToolTransferRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ToolTransferRequest_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ToolTransferRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "firmName" TEXT NOT NULL DEFAULT 'Horizon Technology Services',
    "firmAddress" TEXT,
    "firmGstin" TEXT,
    "firmPhone" TEXT,
    "standardCheckInTime" TEXT NOT NULL DEFAULT '09:00',
    "autoCheckoutTime" TEXT NOT NULL DEFAULT '22:00',
    "maxLunchDurationMins" INTEGER NOT NULL DEFAULT 60,
    "workingDaysPerMonth" INTEGER NOT NULL DEFAULT 26,
    "overtimeMultiplier" REAL NOT NULL DEFAULT 1.5,
    "absentPenaltyRate" REAL NOT NULL DEFAULT 1.0,
    "globalLowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_JobAssignees" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_JobAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "JobCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_JobAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "checkInTime" DATETIME,
    "checkInLat" REAL,
    "checkInLng" REAL,
    "checkInPhoto" TEXT,
    "checkOutTime" DATETIME,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "lunchStartTime" DATETIME,
    "lunchEndTime" DATETIME,
    "lunchDurationMins" INTEGER NOT NULL DEFAULT 0,
    "lunchFlag" TEXT,
    "lunchAutoClose" BOOLEAN NOT NULL DEFAULT false,
    "lunchPenaltyMins" INTEGER NOT NULL DEFAULT 0,
    "checkoutConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "checkoutAuto" BOOLEAN NOT NULL DEFAULT false,
    "checkoutAutoTime" DATETIME,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientUpdatedAt" DATETIME,
    "isMultiDay" BOOLEAN NOT NULL DEFAULT false,
    "expectedCheckoutDate" DATETIME,
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkInLat", "checkInLng", "checkInPhoto", "checkInTime", "checkOutTime", "checkoutAuto", "checkoutAutoTime", "checkoutConfirmed", "createdAt", "date", "firmId", "id", "lateMinutes", "lunchAutoClose", "lunchDurationMins", "lunchEndTime", "lunchFlag", "lunchPenaltyMins", "lunchStartTime", "status", "updatedAt", "userId") SELECT "checkInLat", "checkInLng", "checkInPhoto", "checkInTime", "checkOutTime", "checkoutAuto", "checkoutAutoTime", "checkoutConfirmed", "createdAt", "date", "firmId", "id", "lateMinutes", "lunchAutoClose", "lunchDurationMins", "lunchEndTime", "lunchFlag", "lunchPenaltyMins", "lunchStartTime", "status", "updatedAt", "userId" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");
CREATE TABLE "new_JobCard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "siteAddress" TEXT,
    "mapsLink" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'REPAIR',
    "equipmentNotes" TEXT,
    "notes" TEXT,
    "scheduledDate" DATETIME NOT NULL,
    "estimatedDuration" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "requiresTools" BOOLEAN NOT NULL DEFAULT true,
    "arrivedAt" DATETIME,
    "arrivedLat" REAL,
    "arrivedLng" REAL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "verifiedAt" DATETIME,
    "verifiedById" INTEGER,
    "qualityRating" TEXT,
    "qualityNote" TEXT,
    "verificationBonus" REAL NOT NULL DEFAULT 0,
    "verificationDeduction" REAL NOT NULL DEFAULT 0,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "workSummary" TEXT,
    "beforePhoto" TEXT,
    "completionPhoto" TEXT,
    "issuesFound" TEXT,
    "nextVisitNeeded" BOOLEAN NOT NULL DEFAULT false,
    "clientId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientUpdatedAt" DATETIME,
    CONSTRAINT "JobCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JobCard_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobCard_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_JobCard" ("arrivedAt", "arrivedLat", "arrivedLng", "clientId", "clientName", "clientPhone", "completedAt", "completionPhoto", "createdAt", "createdById", "equipmentNotes", "estimatedDuration", "firmId", "id", "issuesFound", "jobNumber", "jobType", "mapsLink", "nextVisitNeeded", "notes", "scheduledDate", "siteAddress", "status", "updatedAt", "verifiedAt", "verifiedById", "workSummary") SELECT "arrivedAt", "arrivedLat", "arrivedLng", "clientId", "clientName", "clientPhone", "completedAt", "completionPhoto", "createdAt", "createdById", "equipmentNotes", "estimatedDuration", "firmId", "id", "issuesFound", "jobNumber", "jobType", "mapsLink", "nextVisitNeeded", "notes", "scheduledDate", "siteAddress", "status", "updatedAt", "verifiedAt", "verifiedById", "workSummary" FROM "JobCard";
DROP TABLE "JobCard";
ALTER TABLE "new_JobCard" RENAME TO "JobCard";
CREATE UNIQUE INDEX "JobCard_jobNumber_key" ON "JobCard"("jobNumber");
CREATE TABLE "new_MaterialUsageLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobCardId" INTEGER,
    "quantityTaken" REAL NOT NULL,
    "quantityUsed" REAL NOT NULL DEFAULT 0,
    "quantityReturned" REAL NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "overuseFlag" BOOLEAN NOT NULL DEFAULT false,
    "ownerReviewed" BOOLEAN NOT NULL DEFAULT false,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "notes" TEXT,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientUpdatedAt" DATETIME,
    CONSTRAINT "MaterialUsageLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialUsageLog_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaterialUsageLog_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MaterialUsageLog" ("completedAt", "createdAt", "firmId", "id", "jobCardId", "notes", "overuseFlag", "ownerReviewed", "quantityReturned", "quantityTaken", "quantityUsed", "takenAt", "updatedAt", "userId") SELECT "completedAt", "createdAt", "firmId", "id", "jobCardId", "notes", "overuseFlag", "ownerReviewed", "quantityReturned", "quantityTaken", "quantityUsed", "takenAt", "updatedAt", "userId" FROM "MaterialUsageLog";
DROP TABLE "MaterialUsageLog";
ALTER TABLE "new_MaterialUsageLog" RENAME TO "MaterialUsageLog";
CREATE TABLE "new_ToolIssuance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "toolId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobCardId" INTEGER,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" DATETIME,
    "returnedAt" DATETIME,
    "issuedCondition" TEXT NOT NULL DEFAULT 'GOOD',
    "returnCondition" TEXT,
    "penaltyAmount" REAL NOT NULL DEFAULT 0,
    "penaltyApproved" BOOLEAN NOT NULL DEFAULT false,
    "penaltyNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "custodyLocation" TEXT NOT NULL DEFAULT 'OFFICE',
    "homeCustodyApprovedBy" INTEGER,
    "homeCustodyApprovedAt" DATETIME,
    "homeCustodyNote" TEXT,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientUpdatedAt" DATETIME,
    CONSTRAINT "ToolIssuance_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ToolIssuance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ToolIssuance_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ToolIssuance_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ToolIssuance" ("createdAt", "firmId", "id", "issuedAt", "issuedCondition", "jobCardId", "penaltyAmount", "penaltyApproved", "penaltyNote", "returnCondition", "returnedAt", "status", "toolId", "updatedAt", "userId") SELECT "createdAt", "firmId", "id", "issuedAt", "issuedCondition", "jobCardId", "penaltyAmount", "penaltyApproved", "penaltyNote", "returnCondition", "returnedAt", "status", "toolId", "updatedAt", "userId" FROM "ToolIssuance";
DROP TABLE "ToolIssuance";
ALTER TABLE "new_ToolIssuance" RENAME TO "ToolIssuance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "JobRequiredTool_jobCardId_toolId_key" ON "JobRequiredTool"("jobCardId", "toolId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRequiredMaterial_jobCardId_productId_key" ON "JobRequiredMaterial"("jobCardId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "_JobAssignees_AB_unique" ON "_JobAssignees"("A", "B");

-- CreateIndex
CREATE INDEX "_JobAssignees_B_index" ON "_JobAssignees"("B");
