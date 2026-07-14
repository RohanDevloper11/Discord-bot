export interface BotConfig {
  token: string;
  channel: string;
}

export interface BotStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  errorMsg: string | null;
  tag: string | null;
  id: string | null;
  guildsCount: number;
  latency: number;
  activeChannel: { id: string; name: string } | null;
}

export interface AnonMapping {
  userId: string;
  userTag: string;
  anonId: string;
  createdAt: string;
  lastActive: string;
}

export interface ForwardedMessage {
  id: string;
  timestamp: string;
  anonId: string;
  content: string;
  isSimulated?: boolean;
  userTag?: string; // only visible in admin dashboard logs for control
}

export interface DashboardData {
  config: BotConfig;
  status: BotStatus;
  mappings: AnonMapping[];
  messages: ForwardedMessage[];
}
