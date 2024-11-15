export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramLoginWidgetConfig {
  bot_id: string;
  element?: HTMLElement;
  onAuth: (user: TelegramUser) => void | Promise<void>;
  requestAccess?: boolean;
  size?: 'small' | 'medium' | 'large';
  radius?: number | 'default';
  lang?: string;
}

export interface TelegramLoginWidget {
  auth: (config: TelegramLoginWidgetConfig) => void;
}

export interface TelegramSDK {
  Login: {
    auth: (config: TelegramLoginWidgetConfig) => void;
  };
}

declare global {
  interface Window {
    Telegram?: TelegramSDK;
    onTelegramAuth: ((user: TelegramUser) => Promise<void>) | undefined;
    handleTelegramAuth: ((user: TelegramUser) => Promise<void>) | undefined;
  }
}
