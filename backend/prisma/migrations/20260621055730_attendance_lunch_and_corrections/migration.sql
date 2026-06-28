-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "attendanceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "requestType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "firmId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkInLat", "checkInLng", "checkInPhoto", "checkInTime", "checkOutTime", "createdAt", "date", "firmId", "id", "lateMinutes", "status", "updatedAt", "userId") SELECT "checkInLat", "checkInLng", "checkInPhoto", "checkInTime", "checkOutTime", "createdAt", "date", "firmId", "id", "lateMinutes", "status", "updatedAt", "userId" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
