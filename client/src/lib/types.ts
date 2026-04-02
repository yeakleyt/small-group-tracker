export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  appRole: "app_admin" | "member";
  isActive: boolean;
  createdAt: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface GroupMembership {
  id: number;
  userId: number;
  groupId: number;
  role: "group_admin" | "member";
  joinedAt: string;
}

export interface MemberWithUser extends GroupMembership {
  user: User;
}

export interface Invitation {
  id: number;
  token: string;
  email: string;
  groupId: number | null;
  groupRole: string | null;
  invitedByUserId: number;
  isUsed: boolean;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface Meeting {
  id: number;
  groupId: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  hostUserId: number | null;
  isLeaderLocked: boolean;
  createdAt: string;
}

export interface LeaderSignup {
  id: number;
  meetingId: number;
  userId: number;
  assignedByAdminId: number | null;
  createdAt: string;
  user?: User;
}

export interface FoodSlot {
  id: number;
  meetingId: number;
  label: string;
  assignedUserId: number | null;
  isLocked: boolean;
  createdAt: string;
  assignedUser?: User | null;
}

export interface MeetingDetail {
  meeting: Meeting;
  leader: LeaderSignup | null;
  foodSlots: FoodSlot[];
}
