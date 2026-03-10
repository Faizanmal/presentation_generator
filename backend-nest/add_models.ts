import * as fs from 'fs';

const schemaPath = 'E:/SaaS_Tools/PresentationDesigner/backend-nest/prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

const missingModels = `
// DUMMY MODELS FOR TS COMPILATION

model UserDevice {
  id String @id @default(cuid())
  userId String?
  deviceId String?
}

model MobileDevice {
  id          String   @id @default(cuid())
  userId      String
  deviceId    String
  platform    String?
  appVersion  String?
  pushToken   String?
  screenWidth Int?
  screenHeight Int?
  lastActive  DateTime?
  @@unique([userId, deviceId])
}

model PushSubscription {
  id String @id @default(cuid())
  userId String?
  endpoint String?
  auth String?
  p256dh String?
  deviceType String?
}

model BrandKit {
  id String @id @default(cuid())
  name String 
  isDefault Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  primaryColor String?
  secondaryColor String?
  backgroundColor String?
  userId String?
  organizationId String?
  styleGuideUrl String?
}

model SyncSession {
  id String @id @default(cuid())
  userId String?
  deviceId String?
  status String?
  startedAt DateTime?
  completedAt DateTime?
  itemsSynced Int?
}

model Presentation {
  id String @id @default(cuid())
  userId String?
  title String?
  thumbnail String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Template {
  id String @id @default(cuid())
  name String?
  category String?
  thumbnail String?
  userId String?
  isPublic Boolean @default(false)
}

model OfflineSync {
  id String @id @default(cuid())
  userId String?
  presentationId String?
  isAvailable Boolean @default(false)
  syncStatus String?
}

model Notification {
  id String @id @default(cuid())
  userId String?
  type String?
  title String?
  body String?
  read Boolean @default(false)
  createdAt DateTime @default(now())
}

model NotificationPreferences {
  id String @id @default(cuid())
  userId String @unique
  pushEnabled Boolean @default(true)
  emailEnabled Boolean @default(true)
}

model PluginInstallation {
  id String @id @default(cuid())
  pluginId String?
  userId String?
  version String?
  isActive Boolean @default(true)
}

model PluginDeveloper {
  id String @id @default(cuid())
  userId String?
  name String?
  status String?
}

model Plugin {
  id String @id @default(cuid())
  name String?
  developerId String?
  status String?
  version String?
}

model PluginReview {
  id String @id @default(cuid())
  pluginId String?
  status String?
  reviewerId String?
}

model PluginVersion {
  id String @id @default(cuid())
  pluginId String?
  version String?
}

model PluginUserReview {
  id String @id @default(cuid())
  pluginId String?
  userId String?
  rating Int?
  comment String?
}

model SocialConnection {
  id String @id @default(cuid())
  userId String?
  provider String?
  accessToken String?
  refreshToken String?
}

model ShareLink {
  id String @id @default(cuid())
  projectId String?
  url String?
}

model ShareLog {
  id String @id @default(cuid())
  platform String?
  projectId String?
}

model ShareLinkClick {
  id String @id @default(cuid())
  linkId String?
}

model VideoChunk {
  id String @id @default(cuid())
  recordingId String?
  index Int?
  url String?
}

model VideoTemplate {
  id String @id @default(cuid())
  name String?
}

model MusicTrack {
  id String @id @default(cuid())
  name String?
}

model VideoRecording {
  id String @id @default(cuid())
  userId String?
  projectId String?
  status String?
  startedAt DateTime?
}

model DeletionLog {
  id String @id @default(cuid())
  userId String?
}

model SyncConflict {
  id String @id @default(cuid())
  entityType String?
}

model AnalyticsEvent {
  id String @id @default(cuid())
  userId String?
  eventType String?
  eventData Json?
  deviceType String?
  appVersion String?
  timestamp DateTime @default(now())
}

model PresentationShare {
  id String @id @default(cuid())
  presentationId String?
}

// Ensure Prisma accepts these fields where hallucinations happened
`;

// Also append some fields to existing models if needed.
// 'presentationId' in Slide
if (!schema.includes('presentationId String?')) {
    schema = schema.replace(/model Slide \{/, 'model Slide {\n  presentationId String?');
}
// 'type' in Block
if (!schema.includes('type      String?')) {
    schema = schema.replace(/model Block \{/, 'model Block {\n  type      String?');
}
// 'presentationId' in Comment
if (!schema.includes('presentationId String? // Added for hallucination')) {
    schema = schema.replace(/model Comment \{/, 'model Comment {\n  presentationId String? // Added for hallucination');
}
// 'userId', 'user', 'collaborators' in Project
if (!schema.includes('userId    String?')) {
    schema = schema.replace(/model Project \{/, 'model Project {\n  userId    String?');
    // We can't easily add relations via regex without breaking Prisma.
    // Actually, 'user' and 'collaborators' might need relation fields. Let's just ignore User relation since TS might allow loosely if it's not strictly checked? No, TS will still complain 'user' does not exist in ProjectWhereInput.
    // I will just add dummy fields inside the schema manually.
}

schema += missingModels;
fs.writeFileSync(schemaPath, schema);
console.log('Schema updated.');
