import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, inArray, gte, desc, sql } from "drizzle-orm";
import {
  users, groups, groupMemberships, invitations, meetings, leaderSignups, foodSlots, meetingAttendance, resources, resourceLinks, chatMessages, pushSubscriptions,
  type User, type InsertUser,
  type Group, type InsertGroup,
  type GroupMembership, type InsertGroupMembership,
  type Invitation, type InsertInvitation,
  type Meeting, type InsertMeeting,
  type LeaderSignup, type InsertLeaderSignup,
  type FoodSlot, type InsertFoodSlot,
  type MeetingAttendance, type InsertMeetingAttendance,
  type Resource, type InsertResource,
  type ResourceLink, type InsertResourceLink,
  type ChatMessage, type InsertChatMessage,
  type PushSubscription, type InsertPushSubscription,
} from "../shared/schema";
import bcrypt from "bcryptjs";

const dbPath = process.env.NODE_ENV === "production" ? "/data/small-group-tracker.db" : "./data.db";
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);

// ─── Schema migration ───────────────────────────────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    app_role TEXT NOT NULL DEFAULT 'member',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    meeting_day TEXT,
    meeting_time TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    group_id INTEGER NOT NULL REFERENCES groups(id),
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    group_id INTEGER REFERENCES groups(id),
    group_role TEXT DEFAULT 'member',
    invited_by_user_id INTEGER NOT NULL REFERENCES users(id),
    is_used INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    host_user_id INTEGER REFERENCES users(id),
    is_leader_locked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leader_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    assigned_by_admin_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS food_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id),
    label TEXT NOT NULL,
    assigned_user_id INTEGER REFERENCES users(id),
    is_locked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    title TEXT NOT NULL,
    description TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resource_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meeting_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    is_attending INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(meeting_id, user_id)
  );
`);

// ─── Storage interface ──────────────────────────────────────────────────────

export interface IStorage {
  // Users
  getUserById(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getAllUsers(): User[];
  createUser(data: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;

  // Groups
  getGroupById(id: number): Group | undefined;
  getAllGroups(): Group[];
  getGroupsForUser(userId: number): Group[];
  createGroup(data: InsertGroup): Group;
  updateGroup(id: number, data: Partial<InsertGroup>): Group | undefined;
  deleteGroup(id: number): void;

  // Memberships
  getMembership(userId: number, groupId: number): GroupMembership | undefined;
  getMembershipsForUser(userId: number): GroupMembership[];
  getMembershipsForGroup(groupId: number): GroupMembership[];
  addMember(data: InsertGroupMembership): GroupMembership;
  updateMemberRole(userId: number, groupId: number, role: string): void;
  removeMember(userId: number, groupId: number): void;

  // Invitations
  getInvitationByToken(token: string): Invitation | undefined;
  getAllInvitations(): Invitation[];
  getInvitationsCreatedBy(userId: number): Invitation[];
  getInvitationsForGroup(groupId: number): Invitation[];
  createInvitation(data: InsertInvitation): Invitation;
  markInvitationUsed(id: number): void;
  deleteInvitation(id: number): void;

  // Meetings
  getMeetingById(id: number): Meeting | undefined;
  getMeetingsForGroup(groupId: number): Meeting[];
  getUpcomingMeetingsForUser(userId: number, limit?: number): Meeting[];
  getUpcomingMeetingsAllGroups(limit?: number): Meeting[];
  createMeeting(data: InsertMeeting): Meeting;
  updateMeeting(id: number, data: Partial<InsertMeeting>): Meeting | undefined;
  deleteMeeting(id: number): void;

  // Leader signups
  getLeaderSignupForMeeting(meetingId: number): LeaderSignup | undefined;
  createLeaderSignup(data: InsertLeaderSignup): LeaderSignup;
  deleteLeaderSignup(meetingId: number): void;

  // Food slots
  getFoodSlotsForMeeting(meetingId: number): FoodSlot[];
  createFoodSlot(data: InsertFoodSlot): FoodSlot;
  updateFoodSlot(id: number, data: Partial<InsertFoodSlot>): FoodSlot | undefined;
  deleteFoodSlot(id: number): void;
  claimFoodSlot(slotId: number, userId: number): FoodSlot | undefined;
  unclaimFoodSlot(slotId: number): FoodSlot | undefined;

  // Resources
  getResourcesForGroup(groupId: number): Resource[];
  getResourceById(id: number): Resource | undefined;
  createResource(data: InsertResource): Resource;
  updateResource(id: number, data: Partial<InsertResource>): Resource | undefined;
  deleteResource(id: number): void;
  getLinksForResource(resourceId: number): ResourceLink[];
  createResourceLink(data: InsertResourceLink): ResourceLink;
  deleteResourceLink(id: number): void;

  // Chat
  getChatMessages(groupId: number, limit?: number): (ChatMessage & { firstName: string; lastName: string })[];
  getChatMessageById(id: number): ChatMessage | undefined;
  createChatMessage(data: InsertChatMessage): ChatMessage;
  deleteChatMessage(id: number): void;

  // Attendance
  getAttendanceForMeeting(meetingId: number): (MeetingAttendance & { firstName: string; lastName: string })[]; 
  seedAttendance(meetingId: number, userIds: number[]): void;
  setAttendance(meetingId: number, userId: number, isAttending: boolean): MeetingAttendance;
  deleteAttendanceForMeeting(meetingId: number): void;
  backfillAttendance(): void;

  // Push subscriptions
  savePushSubscription(data: InsertPushSubscription): PushSubscription;
  deletePushSubscription(endpoint: string): void;
  getPushSubscriptionsForUsers(userIds: number[]): PushSubscription[];
  getPushSubscriptionByEndpoint(endpoint: string): PushSubscription | undefined;
}

class Storage implements IStorage {
  // ── Users ─────────────────────────────────────────────────────────────────
  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  getAllUsers() {
    return db.select().from(users).all();
  }
  createUser(data: InsertUser) {
    return db.insert(users).values({ ...data, email: data.email.toLowerCase() }).returning().get();
  }
  updateUser(id: number, data: Partial<InsertUser>) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  // ── Groups ────────────────────────────────────────────────────────────────
  getGroupById(id: number) {
    return db.select().from(groups).where(eq(groups.id, id)).get();
  }
  getAllGroups() {
    return db.select().from(groups).all();
  }
  getGroupsForUser(userId: number) {
    const memberships = db.select().from(groupMemberships).where(eq(groupMemberships.userId, userId)).all();
    if (!memberships.length) return [];
    const ids = memberships.map(m => m.groupId);
    return db.select().from(groups).where(inArray(groups.id, ids)).all();
  }
  createGroup(data: InsertGroup) {
    return db.insert(groups).values(data).returning().get();
  }
  updateGroup(id: number, data: Partial<InsertGroup>) {
    return db.update(groups).set(data).where(eq(groups.id, id)).returning().get();
  }
  deleteGroup(id: number) {
    db.delete(groups).where(eq(groups.id, id)).run();
  }

  // ── Memberships ───────────────────────────────────────────────────────────
  getMembership(userId: number, groupId: number) {
    return db.select().from(groupMemberships)
      .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.groupId, groupId)))
      .get();
  }
  getMembershipsForUser(userId: number) {
    return db.select().from(groupMemberships).where(eq(groupMemberships.userId, userId)).all();
  }
  getMembershipsForGroup(groupId: number) {
    return db.select().from(groupMemberships).where(eq(groupMemberships.groupId, groupId)).all();
  }
  addMember(data: InsertGroupMembership) {
    return db.insert(groupMemberships).values(data).returning().get();
  }
  updateMemberRole(userId: number, groupId: number, role: string) {
    db.update(groupMemberships).set({ role })
      .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.groupId, groupId)))
      .run();
  }
  removeMember(userId: number, groupId: number) {
    db.delete(groupMemberships)
      .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.groupId, groupId)))
      .run();
  }

  // ── Invitations ───────────────────────────────────────────────────────────
  getInvitationByToken(token: string) {
    return db.select().from(invitations).where(eq(invitations.token, token)).get();
  }
  getInvitationsCreatedBy(userId: number) {
    return db.select().from(invitations)
      .where(eq(invitations.invitedByUserId, userId))
      .orderBy(desc(invitations.createdAt))
      .all();
  }
  getInvitationsForGroup(groupId: number) {
    return db.select().from(invitations)
      .where(eq(invitations.groupId, groupId))
      .orderBy(desc(invitations.createdAt))
      .all();
  }
  createInvitation(data: InsertInvitation) {
    return db.insert(invitations).values(data).returning().get();
  }
  getAllInvitations() {
    return db.select().from(invitations).orderBy(desc(invitations.createdAt)).all();
  }
  markInvitationUsed(id: number) {
    db.update(invitations).set({ isUsed: true, usedAt: new Date().toISOString() }).where(eq(invitations.id, id)).run();
  }
  deleteInvitation(id: number) {
    db.delete(invitations).where(eq(invitations.id, id)).run();
  }

  // ── Meetings ──────────────────────────────────────────────────────────────
  getMeetingById(id: number) {
    return db.select().from(meetings).where(eq(meetings.id, id)).get();
  }
  getMeetingsForGroup(groupId: number) {
    return db.select().from(meetings)
      .where(eq(meetings.groupId, groupId))
      .orderBy(meetings.date)
      .all();
  }
  getUpcomingMeetingsForUser(userId: number, limit = 10) {
    const memberships = db.select().from(groupMemberships).where(eq(groupMemberships.userId, userId)).all();
    if (!memberships.length) return [];
    const ids = memberships.map(m => m.groupId);
    const today = new Date().toISOString().split("T")[0];
    return db.select().from(meetings)
      .where(and(inArray(meetings.groupId, ids), gte(meetings.date, today)))
      .orderBy(meetings.date)
      .limit(limit)
      .all();
  }
  getUpcomingMeetingsAllGroups(limit = 10) {
    const today = new Date().toISOString().split("T")[0];
    return db.select().from(meetings)
      .where(gte(meetings.date, today))
      .orderBy(meetings.date)
      .limit(limit)
      .all();
  }
  createMeeting(data: InsertMeeting) {
    return db.insert(meetings).values(data).returning().get();
  }
  updateMeeting(id: number, data: Partial<InsertMeeting>) {
    return db.update(meetings).set(data).where(eq(meetings.id, id)).returning().get();
  }
  deleteMeeting(id: number) {
    // cascade delete slots + attendance
    db.delete(foodSlots).where(eq(foodSlots.meetingId, id)).run();
    db.delete(leaderSignups).where(eq(leaderSignups.meetingId, id)).run();
    db.delete(meetingAttendance).where(eq(meetingAttendance.meetingId, id)).run();
    db.delete(meetings).where(eq(meetings.id, id)).run();
  }

  // ── Leader signups ────────────────────────────────────────────────────────
  getLeaderSignupForMeeting(meetingId: number) {
    return db.select().from(leaderSignups).where(eq(leaderSignups.meetingId, meetingId)).get();
  }
  createLeaderSignup(data: InsertLeaderSignup) {
    return db.insert(leaderSignups).values(data).returning().get();
  }
  deleteLeaderSignup(meetingId: number) {
    db.delete(leaderSignups).where(eq(leaderSignups.meetingId, meetingId)).run();
  }

  // ── Food slots ────────────────────────────────────────────────────────────
  getFoodSlotsForMeeting(meetingId: number) {
    return db.select().from(foodSlots).where(eq(foodSlots.meetingId, meetingId)).all();
  }
  createFoodSlot(data: InsertFoodSlot) {
    return db.insert(foodSlots).values(data).returning().get();
  }
  updateFoodSlot(id: number, data: Partial<InsertFoodSlot>) {
    return db.update(foodSlots).set(data).where(eq(foodSlots.id, id)).returning().get();
  }
  deleteFoodSlot(id: number) {
    db.delete(foodSlots).where(eq(foodSlots.id, id)).run();
  }
  claimFoodSlot(slotId: number, userId: number) {
    return db.update(foodSlots).set({ assignedUserId: userId }).where(eq(foodSlots.id, slotId)).returning().get();
  }
  unclaimFoodSlot(slotId: number) {
    return db.update(foodSlots).set({ assignedUserId: null }).where(eq(foodSlots.id, slotId)).returning().get();
  }

  // ── Resources ─────────────────────────────────────────────────────────────
  getResourcesForGroup(groupId: number) {
    return db.select().from(resources).where(eq(resources.groupId, groupId)).all();
  }
  getResourceById(id: number) {
    return db.select().from(resources).where(eq(resources.id, id)).get();
  }
  createResource(data: InsertResource) {
    return db.insert(resources).values(data).returning().get();
  }
  updateResource(id: number, data: Partial<InsertResource>) {
    return db.update(resources).set(data).where(eq(resources.id, id)).returning().get();
  }
  deleteResource(id: number) {
    db.delete(resourceLinks).where(eq(resourceLinks.resourceId, id)).run();
    db.delete(resources).where(eq(resources.id, id)).run();
  }
  getLinksForResource(resourceId: number) {
    return db.select().from(resourceLinks).where(eq(resourceLinks.resourceId, resourceId)).all();
  }
  createResourceLink(data: InsertResourceLink) {
    return db.insert(resourceLinks).values(data).returning().get();
  }
  deleteResourceLink(id: number) {
    db.delete(resourceLinks).where(eq(resourceLinks.id, id)).run();
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  getChatMessages(groupId: number, limit = 100) {
    // Join with users to get sender name in one query
    const rows = db
      .select({
        id: chatMessages.id,
        groupId: chatMessages.groupId,
        userId: chatMessages.userId,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(chatMessages.groupId, groupId))
      .orderBy(chatMessages.createdAt)
      .limit(limit)
      .all();
    return rows;
  }
  getChatMessageById(id: number) {
    return db.select().from(chatMessages).where(eq(chatMessages.id, id)).get();
  }
  createChatMessage(data: InsertChatMessage) {
    return db.insert(chatMessages).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  deleteChatMessage(id: number) {
    db.delete(chatMessages).where(eq(chatMessages.id, id)).run();
  }

  // ── Attendance ─────────────────────────────────────────────────────
  getAttendanceForMeeting(meetingId: number) {
    return db
      .select({
        id: meetingAttendance.id,
        meetingId: meetingAttendance.meetingId,
        userId: meetingAttendance.userId,
        isAttending: meetingAttendance.isAttending,
        updatedAt: meetingAttendance.updatedAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(meetingAttendance)
      .innerJoin(users, eq(meetingAttendance.userId, users.id))
      .where(eq(meetingAttendance.meetingId, meetingId))
      .orderBy(users.firstName, users.lastName)
      .all();
  }
  seedAttendance(meetingId: number, userIds: number[]) {
    const now = new Date().toISOString();
    for (const userId of userIds) {
      db.insert(meetingAttendance)
        .values({ meetingId, userId, isAttending: true, updatedAt: now })
        .onConflictDoNothing()
        .run();
    }
  }
  setAttendance(meetingId: number, userId: number, isAttending: boolean) {
    const now = new Date().toISOString();
    // Upsert
    db.insert(meetingAttendance)
      .values({ meetingId, userId, isAttending, updatedAt: now })
      .onConflictDoUpdate({
        target: [meetingAttendance.meetingId, meetingAttendance.userId],
        set: { isAttending, updatedAt: now },
      })
      .run();
    return db.select().from(meetingAttendance)
      .where(and(eq(meetingAttendance.meetingId, meetingId), eq(meetingAttendance.userId, userId)))
      .get()!;
  }
  deleteAttendanceForMeeting(meetingId: number) {
    db.delete(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId)).run();
  }
  backfillAttendance() {
    const allMeetings = db.select().from(meetings).all();
    for (const meeting of allMeetings) {
      const memberships = db.select().from(groupMemberships)
        .where(eq(groupMemberships.groupId, meeting.groupId)).all();
      this.seedAttendance(meeting.id, memberships.map(m => m.userId));
    }
  }

  // ── Push subscriptions ───────────────────────────────────────────────────────────
  savePushSubscription(data: InsertPushSubscription) {
    // Upsert — if endpoint exists update keys, otherwise insert
    const existing = db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, data.endpoint)).get();
    if (existing) {
      return db.update(pushSubscriptions)
        .set({ p256dh: data.p256dh, auth: data.auth })
        .where(eq(pushSubscriptions.endpoint, data.endpoint))
        .returning().get();
    }
    return db.insert(pushSubscriptions)
      .values({ ...data, createdAt: new Date().toISOString() })
      .returning().get();
  }
  deletePushSubscription(endpoint: string) {
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
  }
  getPushSubscriptionsForUsers(userIds: number[]) {
    if (!userIds.length) return [];
    return db.select().from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds))
      .all();
  }
  getPushSubscriptionByEndpoint(endpoint: string) {
    return db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint)).get();
  }
}

export const storage = new Storage();

// ─── Seed first app admin if no users exist ─────────────────────────────────
export async function seedAdminIfNeeded() {
  const existing = db.select().from(users).all();
  if (existing.length === 0) {
    const hash = await bcrypt.hash("Admin1234!", 10);
    db.insert(users).values({
      email: "admin@example.com",
      passwordHash: hash,
      firstName: "App",
      lastName: "Admin",
      appRole: "app_admin",
      isActive: true,
      createdAt: new Date().toISOString(),
    }).run();
    console.log("✓ Seeded default admin: admin@example.com / Admin1234!");
  }
}
