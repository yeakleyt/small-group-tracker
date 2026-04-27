import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users / Profiles ──────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  appRole: text("app_role").notNull().default("member"), // "app_admin" | "member"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Groups ────────────────────────────────────────────────────────────────

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  meetingDay: text("meeting_day"), // "Monday", "Tuesday", etc.
  meetingTime: text("meeting_time"), // "18:30"
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// ─── Group Memberships ─────────────────────────────────────────────────────

export const groupMemberships = sqliteTable("group_memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  groupId: integer("group_id").notNull().references(() => groups.id),
  role: text("role").notNull().default("member"), // "group_admin" | "member"
  joinedAt: text("joined_at").notNull().default(new Date().toISOString()),
});

export const insertGroupMembershipSchema = createInsertSchema(groupMemberships).omit({ id: true, joinedAt: true });
export type InsertGroupMembership = z.infer<typeof insertGroupMembershipSchema>;
export type GroupMembership = typeof groupMemberships.$inferSelect;

// ─── Invitations ───────────────────────────────────────────────────────────

export const invitations = sqliteTable("invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  groupId: integer("group_id").references(() => groups.id), // null = app-level invite only
  groupRole: text("group_role").default("member"), // "group_admin" | "member"
  invitedByUserId: integer("invited_by_user_id").notNull().references(() => users.id),
  isUsed: integer("is_used", { mode: "boolean" }).notNull().default(false),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true, isUsed: true, usedAt: true });
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

// ─── Meetings ──────────────────────────────────────────────────────────────

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  title: text("title").notNull(),
  date: text("date").notNull(), // ISO date "2025-06-15"
  startTime: text("start_time").notNull(), // "18:00"
  endTime: text("end_time").notNull(),   // "20:00"
  location: text("location"),
  notes: text("notes"),
  hostUserId: integer("host_user_id").references(() => users.id),
  isLeaderLocked: integer("is_leader_locked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// ─── Leader Signups ────────────────────────────────────────────────────────

export const leaderSignups = sqliteTable("leader_signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  userId: integer("user_id").notNull().references(() => users.id),
  assignedByAdminId: integer("assigned_by_admin_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertLeaderSignupSchema = createInsertSchema(leaderSignups).omit({ id: true, createdAt: true });
export type InsertLeaderSignup = z.infer<typeof insertLeaderSignupSchema>;
export type LeaderSignup = typeof leaderSignups.$inferSelect;

// ─── Food Slots ────────────────────────────────────────────────────────────

export const foodSlots = sqliteTable("food_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  label: text("label").notNull(), // "Main Dish", "Dessert", "Drinks", "Sides", "Snacks"
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertFoodSlotSchema = createInsertSchema(foodSlots).omit({ id: true, createdAt: true });
export type InsertFoodSlot = z.infer<typeof insertFoodSlotSchema>;
export type FoodSlot = typeof foodSlots.$inferSelect;

// ─── Meeting Attendance ───────────────────────────────────────────────────────

export const meetingAttendance = sqliteTable("meeting_attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  userId: integer("user_id").notNull().references(() => users.id),
  isAttending: integer("is_attending", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export const insertMeetingAttendanceSchema = createInsertSchema(meetingAttendance).omit({ id: true });
export type InsertMeetingAttendance = z.infer<typeof insertMeetingAttendanceSchema>;
export type MeetingAttendance = typeof meetingAttendance.$inferSelect;

// ─── Group Resources ───────────────────────────────────────────────────────────

export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  title: text("title").notNull(),
  description: text("description"),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resources.$inferSelect;

export const resourceLinks = sqliteTable("resource_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resourceId: integer("resource_id").notNull().references(() => resources.id),
  label: text("label").notNull(),   // e.g. "Chapter 1 PDF", "Amazon link"
  url: text("url").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertResourceLinkSchema = createInsertSchema(resourceLinks).omit({ id: true, createdAt: true });
export type InsertResourceLink = z.infer<typeof insertResourceLinkSchema>;
export type ResourceLink = typeof resourceLinks.$inferSelect;

// ─── Group Chat ────────────────────────────────────────────────────────────────

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Push Subscriptions ────────────────────────────────────────────────────────

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
