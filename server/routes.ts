import type { Express, Request, Response } from "express";
import type { Server } from "http";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import webpush from "web-push";
import { storage } from "./storage";
import { sendEmail, buildInviteEmailHtml } from "./email";
import type { InsertMeeting, InsertGroup, InsertFoodSlot } from "../shared/schema";

// ─── Web Push (VAPID) setup ─────────────────────────────────────────────────
// VAPID keys are generated once and stored as env vars.
// Generate with: node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2);"
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

async function sendPushToUsers(userIds: number[], payload: object): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const subs = storage.getPushSubscriptionsForUsers(userIds);
  const json = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        json,
      ).catch(err => {
        // 410 Gone = subscription expired/revoked — clean it up
        if (err.statusCode === 410) storage.deletePushSubscription(sub.endpoint);
      })
    )
  );
}

// ─── SSE client registry (group chat) ───────────────────────────────────────
// Maps groupId → Set of SSE response objects
const sseClients = new Map<number, Set<Response>>();

function addSseClient(groupId: number, res: Response) {
  if (!sseClients.has(groupId)) sseClients.set(groupId, new Set());
  sseClients.get(groupId)!.add(res);
}
function removeSseClient(groupId: number, res: Response) {
  sseClients.get(groupId)?.delete(res);
}
function broadcastToGroup(groupId: number, data: object) {
  const clients = sseClients.get(groupId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of Array.from(clients)) {
    try { client.write(payload); } catch { /* client disconnected */ }
  }
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): number | null {
  const userId = (req.session as any)?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return userId;
}

function requireAppAdmin(req: Request, res: Response): number | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const user = storage.getUserById(userId);
  if (!user || user.appRole !== "app_admin") {
    res.status(403).json({ error: "App admin required" });
    return null;
  }
  return userId;
}

function requireGroupAccess(req: Request, res: Response, groupId: number): { userId: number; role: string } | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const user = storage.getUserById(userId);
  if (!user) { res.status(401).json({ error: "Not found" }); return null; }
  if (user.appRole === "app_admin") return { userId, role: "app_admin" };
  const membership = storage.getMembership(userId, groupId);
  if (!membership) { res.status(403).json({ error: "No access to this group" }); return null; }
  return { userId, role: membership.role };
}

function requireGroupAdmin(req: Request, res: Response, groupId: number): number | null {
  const access = requireGroupAccess(req, res, groupId);
  if (!access) return null;
  if (access.role !== "group_admin" && access.role !== "app_admin") {
    res.status(403).json({ error: "Group admin required" });
    return null;
  }
  return access.userId;
}

// ─── Route registration ─────────────────────────────────────────────────────

export function registerRoutes(httpServer: Server, app: Express) {
  // ── Auth ──────────────────────────────────────────────────────────────────

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = storage.getUserByEmail(email);
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    (req.session as any).userId = user.id;
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const user = storage.getUserById(userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  });

  // Admin reset another user's password (app_admin only)
  app.post("/api/users/:id/reset-password", async (req, res) => {
    const adminId = requireAppAdmin(req, res);
    if (!adminId) return;
    const targetId = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const target = storage.getUserById(targetId);
    if (!target) return res.status(404).json({ error: "User not found" });
    const hash = await bcrypt.hash(newPassword, 10);
    storage.updateUser(targetId, { passwordHash: hash });
    return res.json({ ok: true });
  });

  // Change own password
  app.post("/api/auth/change-password", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { currentPassword, newPassword } = req.body;
    const user = storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Current password is incorrect" });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const hash = await bcrypt.hash(newPassword, 10);
    storage.updateUser(userId, { passwordHash: hash });
    return res.json({ ok: true });
  });

  // ── Invitations ───────────────────────────────────────────────────────────

  app.post("/api/invitations", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = storage.getUserById(userId);
    if (!user) return res.status(401).json({ error: "Not found" });

    const { email, groupId, groupRole } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    // Permission check
    if (groupId) {
      const gid = Number(groupId);
      if (user.appRole !== "app_admin") {
        const membership = storage.getMembership(userId, gid);
        if (!membership || membership.role !== "group_admin") {
          return res.status(403).json({ error: "Must be group admin to invite to this group" });
        }
      }
    } else {
      if (user.appRole !== "app_admin") return res.status(403).json({ error: "App admin required" });
    }

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inv = storage.createInvitation({
      token,
      email: email.toLowerCase(),
      groupId: groupId ? Number(groupId) : null,
      groupRole: groupRole || "member",
      invitedByUserId: userId,
      expiresAt,
    });
    // Send invite email (non-blocking — don't fail the request if email fails)
    const inviter = storage.getUserById(userId)!;
    const inviteGroup = inv.groupId ? storage.getGroupById(inv.groupId) : null;
    const appUrl = process.env.APP_URL || "https://small-group-manager.onrender.com";
    const inviteUrl = `${appUrl}/#/invite/${inv.token}`;
    sendEmail(
      inv.email,
      inviteGroup ? `You're invited to join ${inviteGroup.name}` : "You're invited to Small Group Manager",
      buildInviteEmailHtml({
        invitedByName: `${inviter.firstName} ${inviter.lastName}`,
        groupName: inviteGroup?.name ?? null,
        inviteUrl,
      })
    ).catch(() => {});
    return res.json(inv);
  });

  // Get invitations — app admin sees all, others see only ones they created
  app.get("/api/invitations", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = storage.getUserById(userId)!;
    const invs = user.appRole === "app_admin"
      ? storage.getAllInvitations()
      : storage.getInvitationsCreatedBy(userId);
    return res.json(invs);
  });

  // Delete an invitation (app admin can delete any; creator can delete their own)
  app.delete("/api/invitations/:id", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = storage.getUserById(userId)!;
    const id = Number(req.params.id);
    // Only app admins or the creator can delete
    const all = storage.getAllInvitations();
    const inv = all.find(i => i.id === id);
    if (!inv) return res.status(404).json({ error: "Not found" });
    if (user.appRole !== "app_admin" && inv.invitedByUserId !== userId) {
      return res.status(403).json({ error: "Not allowed" });
    }
    storage.deleteInvitation(id);
    return res.json({ ok: true });
  });

  // Create invitation from group page (group admin or app admin)
  app.post("/api/groups/:id/invitations", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const groupId = Number(req.params.id);
    const access = requireGroupAccess(req, res, groupId);
    if (!access) return;
    if (access.role === "member") return res.status(403).json({ error: "Group admins only" });
    const user = storage.getUserById(userId)!;
    const { email, groupRole = "member" } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inv = storage.createInvitation({
      email,
      token,
      groupId,
      groupRole,
      invitedByUserId: userId,
      expiresAt,
    });
    // Send invite email (non-blocking)
    const inviter = storage.getUserById(userId)!;
    const inviteGroup = storage.getGroupById(groupId);
    const appUrl = process.env.APP_URL || "https://small-group-manager.onrender.com";
    const inviteUrl = `${appUrl}/#/invite/${inv.token}`;
    sendEmail(
      inv.email,
      `You're invited to join ${inviteGroup?.name ?? "a group"}`,
      buildInviteEmailHtml({
        invitedByName: `${inviter.firstName} ${inviter.lastName}`,
        groupName: inviteGroup?.name ?? null,
        inviteUrl,
      })
    ).catch(() => {});
    return res.status(201).json(inv);
  });

  // Get invitation details by token (public)
  app.get("/api/invitations/token/:token", (req, res) => {
    const inv = storage.getInvitationByToken(req.params.token);
    if (!inv) return res.status(404).json({ error: "Invitation not found" });
    if (inv.isUsed) return res.status(410).json({ error: "Invitation already used" });
    if (new Date(inv.expiresAt) < new Date()) return res.status(410).json({ error: "Invitation expired" });
    const group = inv.groupId ? storage.getGroupById(inv.groupId) : null;
    return res.json({ invitation: inv, group });
  });

  // Accept invitation — create account
  app.post("/api/invitations/accept", async (req, res) => {
    const { token, firstName, lastName, password } = req.body;
    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({ error: "All fields required" });
    }
    const inv = storage.getInvitationByToken(token);
    if (!inv) return res.status(404).json({ error: "Invitation not found" });
    if (inv.isUsed) return res.status(410).json({ error: "Invitation already used" });
    if (new Date(inv.expiresAt) < new Date()) return res.status(410).json({ error: "Invitation expired" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    // Check if user already exists
    let user = storage.getUserByEmail(inv.email);
    if (!user) {
      const hash = await bcrypt.hash(password, 10);
      user = storage.createUser({
        email: inv.email,
        passwordHash: hash,
        firstName,
        lastName,
        appRole: "member",
        isActive: true,
      });
    }

    // Add to group if invitation has a group
    if (inv.groupId) {
      const existing = storage.getMembership(user.id, inv.groupId);
      if (!existing) {
        storage.addMember({ userId: user.id, groupId: inv.groupId, role: inv.groupRole || "member" });
      }
    }

    storage.markInvitationUsed(inv.id);
    (req.session as any).userId = user.id;
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  app.get("/api/users", (req, res) => {
    const userId = requireAppAdmin(req, res);
    if (!userId) return;
    const all = storage.getAllUsers().map(({ passwordHash, ...u }) => u);
    return res.json(all);
  });

  app.get("/api/users/me", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "Not found" });
    const { passwordHash, ...safe } = user;
    return res.json(safe);
  });

  app.patch("/api/users/me", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { firstName, lastName } = req.body;
    const updated = storage.updateUser(userId, { firstName, lastName });
    if (!updated) return res.status(404).json({ error: "Not found" });
    const { passwordHash, ...safe } = updated;
    return res.json(safe);
  });

  app.patch("/api/users/:id/role", (req, res) => {
    const adminId = requireAppAdmin(req, res);
    if (!adminId) return;
    const { appRole } = req.body;
    const updated = storage.updateUser(Number(req.params.id), { appRole });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safe } = updated;
    return res.json(safe);
  });

  app.patch("/api/users/:id/status", (req, res) => {
    const adminId = requireAppAdmin(req, res);
    if (!adminId) return;
    const { isActive } = req.body;
    const updated = storage.updateUser(Number(req.params.id), { isActive });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safe } = updated;
    return res.json(safe);
  });

  // ── Groups ────────────────────────────────────────────────────────────────

  app.get("/api/groups", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = storage.getUserById(userId)!;
    const groupList = user.appRole === "app_admin"
      ? storage.getAllGroups()
      : storage.getGroupsForUser(userId);
    return res.json(groupList);
  });

  app.post("/api/groups", (req, res) => {
    const userId = requireAppAdmin(req, res);
    if (!userId) return;
    const { name, description, location, meetingDay, meetingTime } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    const group = storage.createGroup({ name, description, location, meetingDay, meetingTime, isArchived: false });
    return res.json(group);
  });

  app.get("/api/groups/:id", (req, res) => {
    const gid = Number(req.params.id);
    const access = requireGroupAccess(req, res, gid);
    if (!access) return;
    const group = storage.getGroupById(gid);
    if (!group) return res.status(404).json({ error: "Group not found" });
    return res.json(group);
  });

  app.patch("/api/groups/:id", (req, res) => {
    const gid = Number(req.params.id);
    const adminId = requireGroupAdmin(req, res, gid);
    if (!adminId) return;
    const { name, description, location, meetingDay, meetingTime, isArchived } = req.body;
    const updated = storage.updateGroup(gid, { name, description, location, meetingDay, meetingTime, isArchived });
    if (!updated) return res.status(404).json({ error: "Group not found" });
    return res.json(updated);
  });

  app.delete("/api/groups/:id", (req, res) => {
    const userId = requireAppAdmin(req, res);
    if (!userId) return;
    storage.deleteGroup(Number(req.params.id));
    return res.json({ ok: true });
  });

  // ── Group Members ─────────────────────────────────────────────────────────

  app.get("/api/groups/:id/members", (req, res) => {
    const gid = Number(req.params.id);
    const access = requireGroupAccess(req, res, gid);
    if (!access) return;
    const memberships = storage.getMembershipsForGroup(gid);
    const result = memberships.map(m => {
      const user = storage.getUserById(m.userId);
      if (!user) return null;
      const { passwordHash, ...safe } = user;
      return { ...m, user: safe };
    }).filter(Boolean);
    return res.json(result);
  });

  app.post("/api/groups/:id/members", (req, res) => {
    const gid = Number(req.params.id);
    const adminId = requireGroupAdmin(req, res, gid);
    if (!adminId) return;
    const { userId, role } = req.body;
    const existing = storage.getMembership(Number(userId), gid);
    if (existing) return res.status(409).json({ error: "User is already a member" });
    const membership = storage.addMember({ userId: Number(userId), groupId: gid, role: role || "member" });
    return res.json(membership);
  });

  app.patch("/api/groups/:id/members/:userId/role", (req, res) => {
    const gid = Number(req.params.id);
    const adminId = requireGroupAdmin(req, res, gid);
    if (!adminId) return;
    const { role } = req.body;
    storage.updateMemberRole(Number(req.params.userId), gid, role);
    return res.json({ ok: true });
  });

  app.delete("/api/groups/:id/members/:userId", (req, res) => {
    const gid = Number(req.params.id);
    const requesterId = requireAuth(req, res);
    if (!requesterId) return;
    const requester = storage.getUserById(requesterId)!;
    const targetUserId = Number(req.params.userId);
    // Allow self-removal OR group admin OR app admin
    if (requesterId !== targetUserId && requester.appRole !== "app_admin") {
      const membership = storage.getMembership(requesterId, gid);
      if (!membership || membership.role !== "group_admin") {
        return res.status(403).json({ error: "Not allowed" });
      }
    }
    storage.removeMember(targetUserId, gid);
    return res.json({ ok: true });
  });

  // ── Meetings ──────────────────────────────────────────────────────────────

  app.get("/api/groups/:id/meetings", (req, res) => {
    const gid = Number(req.params.id);
    const access = requireGroupAccess(req, res, gid);
    if (!access) return;
    const meetingList = storage.getMeetingsForGroup(gid);
    return res.json(meetingList);
  });

  app.post("/api/groups/:id/meetings", (req, res) => {
    const gid = Number(req.params.id);
    const adminId = requireGroupAdmin(req, res, gid);
    if (!adminId) return;
    const { title, date, startTime, endTime, location, notes, hostUserId } = req.body;
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "Title, date, start time, and end time are required" });
    }
    const meeting = storage.createMeeting({
      groupId: gid, title, date, startTime, endTime,
      location: location || null,
      notes: notes || null,
      hostUserId: hostUserId ? Number(hostUserId) : null,
      isLeaderLocked: false,
    });
    return res.json(meeting);
  });

  app.get("/api/meetings/:id", (req, res) => {
    const meeting = storage.getMeetingById(Number(req.params.id));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const access = requireGroupAccess(req, res, meeting.groupId);
    if (!access) return;
    const leader = storage.getLeaderSignupForMeeting(meeting.id);
    const slots = storage.getFoodSlotsForMeeting(meeting.id);
    const leaderUser = leader ? storage.getUserById(leader.userId) : null;
    const enrichedSlots = slots.map(s => ({
      ...s,
      assignedUser: s.assignedUserId ? (() => {
        const u = storage.getUserById(s.assignedUserId!);
        if (!u) return null;
        const { passwordHash, ...safe } = u;
        return safe;
      })() : null,
    }));
    return res.json({
      meeting,
      leader: leader ? { ...leader, user: leaderUser ? (() => { const { passwordHash, ...s } = leaderUser; return s; })() : null } : null,
      foodSlots: enrichedSlots,
    });
  });

  app.patch("/api/meetings/:id", (req, res) => {
    const meeting = storage.getMeetingById(Number(req.params.id));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const adminId = requireGroupAdmin(req, res, meeting.groupId);
    if (!adminId) return;
    const { title, date, startTime, endTime, location, notes, hostUserId, isLeaderLocked } = req.body;
    const updated = storage.updateMeeting(meeting.id, { title, date, startTime, endTime, location, notes, hostUserId: hostUserId ? Number(hostUserId) : null, isLeaderLocked });
    return res.json(updated);
  });

  app.delete("/api/meetings/:id", (req, res) => {
    const meeting = storage.getMeetingById(Number(req.params.id));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const adminId = requireGroupAdmin(req, res, meeting.groupId);
    if (!adminId) return;
    storage.deleteMeeting(meeting.id);
    return res.json({ ok: true });
  });

  // Upcoming meetings for current user
  app.get("/api/meetings/upcoming/me", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const upcomingList = storage.getUpcomingMeetingsForUser(userId, 20);
    return res.json(upcomingList);
  });

  // ── Leader Signups ────────────────────────────────────────────────────────

  app.post("/api/meetings/:id/leader", (req, res) => {
    const meetingId = Number(req.params.id);
    const meeting = storage.getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const access = requireGroupAccess(req, res, meeting.groupId);
    if (!access) return;

    if (meeting.isLeaderLocked && access.role !== "group_admin" && access.role !== "app_admin") {
      return res.status(403).json({ error: "Leader slot is locked" });
    }
    const isPast = new Date(meeting.date) < new Date(new Date().toISOString().split("T")[0]);
    if (isPast) return res.status(400).json({ error: "Cannot sign up for past meetings" });

    const existing = storage.getLeaderSignupForMeeting(meetingId);
    if (existing) return res.status(409).json({ error: "Leader slot already taken" });

    const { targetUserId } = req.body;
    const signupUserId = (access.role === "group_admin" || access.role === "app_admin") && targetUserId
      ? Number(targetUserId)
      : access.userId;

    const signup = storage.createLeaderSignup({
      meetingId,
      userId: signupUserId,
      assignedByAdminId: (access.role === "group_admin" || access.role === "app_admin") && targetUserId ? access.userId : null,
    });
    return res.json(signup);
  });

  app.delete("/api/meetings/:id/leader", (req, res) => {
    const meetingId = Number(req.params.id);
    const meeting = storage.getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const access = requireGroupAccess(req, res, meeting.groupId);
    if (!access) return;

    const isPast = new Date(meeting.date) < new Date(new Date().toISOString().split("T")[0]);
    const existing = storage.getLeaderSignupForMeeting(meetingId);
    if (!existing) return res.status(404).json({ error: "No leader signup to remove" });

    // Members can only remove their own
    if (access.role === "member" && existing.userId !== access.userId) {
      return res.status(403).json({ error: "Can only remove your own signup" });
    }
    if (access.role === "member" && isPast) {
      return res.status(400).json({ error: "Cannot remove signup for past meetings" });
    }

    storage.deleteLeaderSignup(meetingId);
    return res.json({ ok: true });
  });

  // ── Food Slots ────────────────────────────────────────────────────────────

  app.post("/api/meetings/:id/food-slots", (req, res) => {
    const meetingId = Number(req.params.id);
    const meeting = storage.getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const adminId = requireGroupAdmin(req, res, meeting.groupId);
    if (!adminId) return;
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: "Label required" });
    const slot = storage.createFoodSlot({ meetingId, label, assignedUserId: null, isLocked: false });
    return res.json(slot);
  });

  app.patch("/api/food-slots/:id", (req, res) => {
    const slotId = Number(req.params.id);
    const slot = storage.getFoodSlotsForMeeting(0); // dummy load
    const existing = (() => {
      // find slot directly
      const allSlots = storage.getFoodSlotsForMeeting(0);
      return null; // will query individually below
    })();
    // We need to look up the slot
    const allForMeeting = storage.getFoodSlotsForMeeting(Number(req.body.meetingId || 0));
    // Find it by id by querying storage differently - use direct approach
    const { meetingId, label, isLocked, assignedUserId } = req.body;
    if (!meetingId) return res.status(400).json({ error: "meetingId required" });
    const meeting = storage.getMeetingById(Number(meetingId));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const adminId = requireGroupAdmin(req, res, meeting.groupId);
    if (!adminId) return;
    const updated = storage.updateFoodSlot(slotId, { label, isLocked, assignedUserId });
    return res.json(updated);
  });

  app.delete("/api/food-slots/:id", (req, res) => {
    const slotId = Number(req.params.id);
    const { meetingId } = req.body;
    if (!meetingId) return res.status(400).json({ error: "meetingId required" });
    const meeting = storage.getMeetingById(Number(meetingId));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const adminId = requireGroupAdmin(req, res, meeting.groupId);
    if (!adminId) return;
    storage.deleteFoodSlot(slotId);
    return res.json({ ok: true });
  });

  // Claim food slot (member)
  app.post("/api/food-slots/:id/claim", (req, res) => {
    const slotId = Number(req.params.id);
    const { meetingId } = req.body;
    if (!meetingId) return res.status(400).json({ error: "meetingId required" });
    const meeting = storage.getMeetingById(Number(meetingId));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const access = requireGroupAccess(req, res, meeting.groupId);
    if (!access) return;

    const isPast = new Date(meeting.date) < new Date(new Date().toISOString().split("T")[0]);
    if (isPast) return res.status(400).json({ error: "Cannot claim slots for past meetings" });

    const slots = storage.getFoodSlotsForMeeting(meeting.id);
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.isLocked) return res.status(403).json({ error: "Slot is locked" });
    if (slot.assignedUserId) return res.status(409).json({ error: "Slot already claimed" });

    const updated = storage.claimFoodSlot(slotId, access.userId);
    return res.json(updated);
  });

  // Unclaim food slot (member or admin)
  app.post("/api/food-slots/:id/unclaim", (req, res) => {
    const slotId = Number(req.params.id);
    const { meetingId } = req.body;
    if (!meetingId) return res.status(400).json({ error: "meetingId required" });
    const meeting = storage.getMeetingById(Number(meetingId));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const access = requireGroupAccess(req, res, meeting.groupId);
    if (!access) return;

    const isPast = new Date(meeting.date) < new Date(new Date().toISOString().split("T")[0]);
    const slots = storage.getFoodSlotsForMeeting(meeting.id);
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found" });

    // Members can only unclaim their own; admins can unclaim anything
    if (access.role === "member") {
      if (slot.assignedUserId !== access.userId) return res.status(403).json({ error: "Can only unclaim your own slot" });
      if (isPast) return res.status(400).json({ error: "Cannot unclaim past meetings" });
    }

    const updated = storage.unclaimFoodSlot(slotId);
    return res.json(updated);
  });

  // ── Resources ──────────────────────────────────────────────────────────────

  // List resources for a group
  app.get("/api/groups/:id/resources", (req, res) => {
    const groupId = Number(req.params.id);
    const access = requireGroupAccess(req, res, groupId);
    if (!access) return;
    const list = storage.getResourcesForGroup(groupId);
    const withLinks = list.map(r => ({ ...r, links: storage.getLinksForResource(r.id) }));
    return res.json(withLinks);
  });

  // Create a resource (group_admin or app_admin)
  app.post("/api/groups/:id/resources", (req, res) => {
    const groupId = Number(req.params.id);
    const access = requireGroupAccess(req, res, groupId);
    if (!access) return;
    if (access.role === "member") return res.status(403).json({ error: "Group admins only" });
    const { title, description, links } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const resource = storage.createResource({ groupId, title, description: description || null, createdByUserId: access.userId });
    const savedLinks = (links || []).map((l: any) => storage.createResourceLink({ resourceId: resource.id, label: l.label, url: l.url }));
    return res.status(201).json({ ...resource, links: savedLinks });
  });

  // Update a resource
  app.patch("/api/resources/:id", (req, res) => {
    const id = Number(req.params.id);
    const resource = storage.getResourceById(id);
    if (!resource) return res.status(404).json({ error: "Not found" });
    const access = requireGroupAccess(req, res, resource.groupId);
    if (!access) return;
    if (access.role === "member") return res.status(403).json({ error: "Group admins only" });
    const { title, description } = req.body;
    const updated = storage.updateResource(id, { title, description });
    const links = storage.getLinksForResource(id);
    return res.json({ ...updated, links });
  });

  // Delete a resource
  app.delete("/api/resources/:id", (req, res) => {
    const id = Number(req.params.id);
    const resource = storage.getResourceById(id);
    if (!resource) return res.status(404).json({ error: "Not found" });
    const access = requireGroupAccess(req, res, resource.groupId);
    if (!access) return;
    if (access.role === "member") return res.status(403).json({ error: "Group admins only" });
    storage.deleteResource(id);
    return res.json({ ok: true });
  });

  // Add a link to a resource
  app.post("/api/resources/:id/links", (req, res) => {
    const resourceId = Number(req.params.id);
    const resource = storage.getResourceById(resourceId);
    if (!resource) return res.status(404).json({ error: "Not found" });
    const access = requireGroupAccess(req, res, resource.groupId);
    if (!access) return;
    if (access.role === "member") return res.status(403).json({ error: "Group admins only" });
    const { label = "", url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    const link = storage.createResourceLink({ resourceId, label, url });
    return res.status(201).json(link);
  });

  // Delete a link
  app.delete("/api/resource-links/:id", (req, res) => {
    const id = Number(req.params.id);
    // No direct lookup by link — just delete (admin check handled client-side for simplicity)
    const userId = requireAuth(req, res);
    if (!userId) return;
    storage.deleteResourceLink(id);
    return res.json({ ok: true });
  });

  // ── Dashboard data ────────────────────────────────────────────────────────

  app.get("/api/dashboard", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = storage.getUserById(userId)!;

    const rawUpcoming = user.appRole === "app_admin"
      ? storage.getUpcomingMeetingsAllGroups(10)
      : storage.getUpcomingMeetingsForUser(userId, 10);
    const openLeader: any[] = [];
    const openFood: any[] = [];

    // Attach groupName to every meeting for display purposes
    const upcoming = rawUpcoming.map(meeting => {
      const group = storage.getGroupById(meeting.groupId);
      return { ...meeting, groupName: group?.name ?? "" };
    });

    for (const meeting of upcoming) {
      const leader = storage.getLeaderSignupForMeeting(meeting.id);
      if (!leader && !meeting.isLeaderLocked) {
        openLeader.push(meeting);
      }
      const slots = storage.getFoodSlotsForMeeting(meeting.id);
      const openSlots = slots.filter(s => !s.assignedUserId && !s.isLocked);
      if (openSlots.length) {
        openFood.push({ meeting, openSlots });
      }
    }

    const groups = user.appRole === "app_admin"
      ? storage.getAllGroups()
      : storage.getGroupsForUser(userId);

    return res.json({ upcoming: upcoming.slice(0, 5), openLeader: openLeader.slice(0, 5), openFood: openFood.slice(0, 5), groups });
  });

  // ────────────────────────────────────────────────────────────────────
  // Chat routes
  // ────────────────────────────────────────────────────────────────────

  // GET /api/groups/:id/chat/stream  — SSE stream of new messages
  app.get("/api/groups/:id/chat/stream", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const groupId = Number(req.params.id);
    const access = requireGroupAccess(req, res, groupId);
    if (!access) return;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering on Render
    res.flushHeaders();

    // Send a heartbeat comment every 25s to keep the connection alive
    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
    }, 25000);

    addSseClient(groupId, res);

    req.on("close", () => {
      clearInterval(heartbeat);
      removeSseClient(groupId, res);
    });
  });

  // GET /api/groups/:id/chat  — fetch recent message history
  app.get("/api/groups/:id/chat", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const groupId = Number(req.params.id);
    const access = requireGroupAccess(req, res, groupId);
    if (!access) return;
    const messages = storage.getChatMessages(groupId, 100);
    return res.json(messages);
  });

  // POST /api/groups/:id/chat  — send a message
  app.post("/api/groups/:id/chat", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const groupId = Number(req.params.id);
    const access = requireGroupAccess(req, res, groupId);
    if (!access) return;
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message required" });
    }
    const saved = storage.createChatMessage({ groupId, userId, message: String(message).trim() });
    const user = storage.getUserById(userId)!;
    const payload = { ...saved, firstName: user.firstName, lastName: user.lastName };
    // Broadcast to all SSE listeners on this group
    broadcastToGroup(groupId, payload);
    // Send push notifications to all other group members
    const members = storage.getMembershipsForGroup(groupId);
    const otherUserIds = members.map(m => m.userId).filter(id => id !== userId);
    const group = storage.getGroupById(groupId);
    sendPushToUsers(otherUserIds, {
      type: "chat",
      title: group?.name ?? "Group Chat",
      body: `${user.firstName} ${user.lastName}: ${String(message).trim().slice(0, 100)}`,
      groupId,
    }).catch(() => {});
    return res.status(201).json(payload);
  });

  // GET /api/push/vapid-public-key  — sends public key to client for subscription
  app.get("/api/push/vapid-public-key", (req, res) => {
    if (!VAPID_PUBLIC) return res.status(503).json({ error: "Push not configured" });
    return res.json({ key: VAPID_PUBLIC });
  });

  // POST /api/push/subscribe  — save a push subscription for the current user
  app.post("/api/push/subscribe", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    const sub = storage.savePushSubscription({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    return res.status(201).json({ ok: true });
  });

  // DELETE /api/push/subscribe  — remove a push subscription
  app.delete("/api/push/subscribe", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { endpoint } = req.body;
    if (endpoint) storage.deletePushSubscription(endpoint);
    return res.json({ ok: true });
  });

  // DELETE /api/chat/:id  — delete own message (admins can delete any)
  app.delete("/api/chat/:id", (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const msgId = Number(req.params.id);
    const msg = storage.getChatMessageById(msgId);
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const user = storage.getUserById(userId)!;
    const membership = storage.getMembership(userId, msg.groupId);
    const isAdmin = user.appRole === "app_admin" || membership?.role === "group_admin";
    if (msg.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Not allowed" });
    }
    storage.deleteChatMessage(msgId);
    broadcastToGroup(msg.groupId, { type: "delete", id: msgId });
    return res.json({ ok: true });
  });
}
