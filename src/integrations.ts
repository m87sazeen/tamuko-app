// Messaging integrations.
// Phase 1 (works now, free, no API keys): open the customer's chosen app with a pre-filled
// message (receipt summary, "your order is ready"). The operator presses Send in that app.
// Phase 2 (needs the cloud backend): automated sending via official business APIs
// (WhatsApp Cloud API, LINE Messaging API, Telegram Bot API, Kakao, Zalo OA, WeChat OA).
// API tokens must live on a server — they are never stored in this app.
import { Linking, Platform } from 'react-native';

export type Channel = {
  id: string;
  name: string;
  regions: string;
  handleLabel: string; // what the business enters (its own contact handle)
  share?: (text: string, phone?: string) => string; // deep link for pre-filled message
  businessApi: string;
};

const enc = encodeURIComponent;

export const CHANNELS: Channel[] = [
  {
    id: 'whatsapp', name: 'WhatsApp', regions: 'Middle East, South & Southeast Asia', handleLabel: 'Business WhatsApp number (+country code)',
    share: (t, p) => `https://wa.me/${p ? p.replace(/[^\d]/g, '') : ''}?text=${enc(t)}`,
    businessApi: 'WhatsApp Cloud API (Meta) — template messages for order updates',
  },
  {
    id: 'line', name: 'LINE', regions: 'Thailand, Japan, Taiwan', handleLabel: 'LINE Official Account ID (e.g. @yourshop)',
    share: (t) => `https://line.me/R/msg/text/?${enc(t)}`,
    businessApi: 'LINE Messaging API — push messages from your Official Account',
  },
  {
    id: 'telegram', name: 'Telegram', regions: 'Central Asia, Middle East', handleLabel: 'Telegram username or bot',
    share: (t) => `https://t.me/share/url?url=${enc(' ')}&text=${enc(t)}`,
    businessApi: 'Telegram Bot API — free bot notifications',
  },
  {
    id: 'viber', name: 'Viber', regions: 'Philippines, Myanmar, Middle East', handleLabel: 'Viber number or community',
    share: (t) => `viber://forward?text=${enc(t)}`,
    businessApi: 'Viber Business Messages',
  },
  {
    id: 'messenger', name: 'Messenger', regions: 'Philippines, Southeast Asia', handleLabel: 'Facebook Page username',
    businessApi: 'Messenger Platform — Page messaging',
  },
  { id: 'zalo', name: 'Zalo', regions: 'Vietnam', handleLabel: 'Zalo OA ID or phone', businessApi: 'Zalo Official Account API (ZNS notifications)' },
  { id: 'kakao', name: 'KakaoTalk', regions: 'South Korea', handleLabel: 'Kakao Channel ID', businessApi: 'Kakao AlimTalk notifications' },
  { id: 'wechat', name: 'WeChat', regions: 'China', handleLabel: 'WeChat ID / Official Account', businessApi: 'WeChat Official Account template messages' },
  {
    id: 'sms', name: 'SMS', regions: 'Everywhere', handleLabel: 'Shop phone number',
    share: (t, p) => (Platform.OS === 'ios' ? `sms:${p ?? ''}&body=${enc(t)}` : `sms:${p ?? ''}?body=${enc(t)}`),
    businessApi: 'Bulk SMS provider (per-message cost)',
  },
  {
    id: 'email', name: 'Email', regions: 'Everywhere', handleLabel: 'Shop email',
    share: (t) => `mailto:?subject=${enc('Your receipt')}&body=${enc(t)}`,
    businessApi: 'Transactional email provider',
  },
];

export async function openShare(ch: Channel, text: string, phone?: string): Promise<string | null> {
  if (!ch.share) return `${ch.name} has no share link — copy the message and paste it in ${ch.name}.`;
  const url = ch.share(text, phone);
  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return null;
    }
    await Linking.openURL(url);
    return null;
  } catch {
    return `${ch.name} is not installed on this device.`;
  }
}
