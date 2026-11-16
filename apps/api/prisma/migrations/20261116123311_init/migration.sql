-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('mr', 'en');

-- CreateEnum
CREATE TYPE "CaseRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaseKind" AS ENUM ('CIVIL', 'LAND_PROPERTY', 'TITLE_SEARCH', 'CRIMINAL', 'FAMILY', 'REVENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('PETITIONER', 'RESPONDENT', 'PLAINTIFF', 'DEFENDANT', 'APPLICANT', 'OPPONENT', 'APPELLANT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('SEVEN_TWELVE', 'FERFAR', 'EIGHT_A', 'INDEX_II', 'SALE_DEED', 'GIFT_DEED', 'WILL', 'PARTITION_DEED', 'MORTGAGE_DEED', 'COURT_ORDER', 'OTHER');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('RECORD_SNAPSHOT', 'DEED', 'MUTATION');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "Advocate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "barCouncilNo" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'mr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advocate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamber" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chamber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamberMember" (
    "id" TEXT NOT NULL,
    "chamberId" TEXT NOT NULL,
    "advocateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamberMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAccess" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "advocateId" TEXT NOT NULL,
    "role" "CaseRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "advocateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" TEXT NOT NULL,
    "advocateId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "CaseKind" NOT NULL DEFAULT 'CIVIL',
    "caseNumber" TEXT,
    "court" TEXT,
    "cnrNumber" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "filedOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "isOurClient" BOOLEAN NOT NULL DEFAULT false,
    "opposingCounsel" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "surveyNo" TEXT,
    "gatNo" TEXT,
    "hissaNo" TEXT,
    "village" TEXT,
    "taluka" TEXT,
    "district" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" "DocType" NOT NULL DEFAULT 'OTHER',
    "year" INTEGER,
    "title" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNo" INTEGER NOT NULL,
    "storageKey" TEXT,
    "ocrText" TEXT,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fact" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT,
    "pageId" TEXT,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "cropX" DOUBLE PRECISION,
    "cropY" DOUBLE PRECISION,
    "cropW" DOUBLE PRECISION,
    "cropH" DOUBLE PRECISION,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "subtype" TEXT,
    "ferfarNo" TEXT,
    "deedRegNo" TEXT,
    "fromParties" TEXT[],
    "toParties" TEXT[],
    "owners" TEXT[],
    "areaSqm" DOUBLE PRECISION,
    "landClass" TEXT,
    "otherRights" TEXT[],
    "section155" BOOLEAN NOT NULL DEFAULT false,
    "refDeedRegNo" TEXT,
    "factIds" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "propertyId" TEXT,
    "rule" TEXT NOT NULL,
    "severity" "FlagSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "eventIds" TEXT[],
    "factIds" TEXT[],
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "language" "Locale" NOT NULL DEFAULT 'mr',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hearing" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "court" TEXT,
    "purpose" TEXT,
    "nextStep" TEXT,
    "outcome" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAgreement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "clientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "mode" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "advocateId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Advocate_email_key" ON "Advocate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Chamber_ownerId_key" ON "Chamber"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChamberMember_chamberId_advocateId_key" ON "ChamberMember"("chamberId", "advocateId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseAccess_caseId_advocateId_key" ON "CaseAccess"("caseId", "advocateId");

-- CreateIndex
CREATE INDEX "Client_advocateId_idx" ON "Client"("advocateId");

-- CreateIndex
CREATE INDEX "CaseFile_advocateId_status_idx" ON "CaseFile"("advocateId", "status");

-- CreateIndex
CREATE INDEX "CaseFile_clientId_idx" ON "CaseFile"("clientId");

-- CreateIndex
CREATE INDEX "Party_caseId_idx" ON "Party"("caseId");

-- CreateIndex
CREATE INDEX "Property_caseId_idx" ON "Property"("caseId");

-- CreateIndex
CREATE INDEX "Document_caseId_idx" ON "Document"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_documentId_pageNo_key" ON "Page"("documentId", "pageNo");

-- CreateIndex
CREATE INDEX "Fact_caseId_field_idx" ON "Fact"("caseId", "field");

-- CreateIndex
CREATE INDEX "OwnershipEvent_propertyId_date_idx" ON "OwnershipEvent"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Flag_caseId_idx" ON "Flag"("caseId");

-- CreateIndex
CREATE INDEX "Draft_caseId_idx" ON "Draft"("caseId");

-- CreateIndex
CREATE INDEX "Hearing_caseId_date_idx" ON "Hearing"("caseId", "date");

-- CreateIndex
CREATE INDEX "FeeAgreement_clientId_idx" ON "FeeAgreement"("clientId");

-- CreateIndex
CREATE INDEX "AccessLog_advocateId_at_idx" ON "AccessLog"("advocateId", "at");

-- CreateIndex
CREATE INDEX "AccessLog_entityType_entityId_idx" ON "AccessLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Chamber" ADD CONSTRAINT "Chamber_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Advocate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamberMember" ADD CONSTRAINT "ChamberMember_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamberMember" ADD CONSTRAINT "ChamberMember_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "Advocate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAccess" ADD CONSTRAINT "CaseAccess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAccess" ADD CONSTRAINT "CaseAccess_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "Advocate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "Advocate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "Advocate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipEvent" ADD CONSTRAINT "OwnershipEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "FeeAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "FeeAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "Advocate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
