export type ChessRoom = {
  id: string; mode: "ai" | "multiplayer"; difficulty: "beginner" | "practice";
  status: "waiting" | "active" | "completed" | "cancelled";
  fen: string; version: number; result: string | null; resultReason: string | null;
  yourColor: "w" | "b" | null; white: string; black: string;
  drawOffer: "yours" | "opponent" | null; moves: string[]; legalMoves: { from: string; to: string; promotion?: string }[];
  inCheck: boolean; turn: "w" | "b"; createdAt: string; updatedAt: string;
};
export type ChessStanding = { id: string; handle: string; displayName: string; campusName: string; points: number; wins: number; losses: number; draws: number; games: number };
