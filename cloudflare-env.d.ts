declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MODERATION_API_URL?: string;
    MODERATION_API_KEY?: string;
    MODERATION_MODEL?: string;
    LIVEKIT_URL?: string;
    LIVEKIT_API_KEY?: string;
    LIVEKIT_API_SECRET?: string;
    EMAIL_API_URL?: string;
    EMAIL_API_KEY?: string;
  }
}
