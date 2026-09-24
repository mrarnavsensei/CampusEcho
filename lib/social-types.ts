export type PublicPerson = { id: string; handle: string; displayName: string; bio: string; isPrivate: boolean; verified: boolean };
export type SocialPost = {
  id: string; alias: string | null; visibility: "anonymous" | "profile"; body: string; kind: string;
  createdAt: string; editedAt: string | null; author: PublicPerson | null; isOwn: boolean;
  likes: number; liked: boolean; comments: number; saved: boolean;
  poll: null | { id: string; closesAt: string | null; options: Array<{ id: string; label: string; votes: number }>; votedOptionId: string | null };
};
export type SocialComment = { id: string; body: string; alias: string; createdAt: string; editedAt: string | null; author: null; isOwn: boolean };
export type SocialProfile = PublicPerson & { campusId: string; campusName: string; anonymousByDefault: boolean; followers: number; following: number; isFollowing: boolean; isBlocked: boolean; isOwn: boolean; canViewPosts: boolean };
export type SocialMessage = { id: string; body: string; senderId: string; isOwn: boolean; createdAt: string; deleted: boolean; read: boolean };
export type SocialConversation = { id: string; other: PublicPerson; lastMessage: string | null; lastMessageAt: string | null; unread: number; blocked: boolean };
export type SocialEvent = { id: string; title: string; description: string; game: string | null; startsAt: string; capacity: number | null; status: string; registered: boolean; registrations: number };
export type Page<T> = { items: T[]; nextCursor: string | null };
