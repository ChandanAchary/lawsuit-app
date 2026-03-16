import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

export type ChatSessionEvent = {
  chatId: string;
  source: 'daily';
};

const CHAT_SESSION_OPENED = 'chat:session:opened';
const CHAT_SESSION_CLOSED = 'chat:session:closed';

export const emitChatSessionOpened = (payload: ChatSessionEvent) => {
  DeviceEventEmitter.emit(CHAT_SESSION_OPENED, payload);
};

export const emitChatSessionClosed = (payload: ChatSessionEvent) => {
  DeviceEventEmitter.emit(CHAT_SESSION_CLOSED, payload);
};

export const onChatSessionOpened = (listener: (payload: ChatSessionEvent) => void): (() => void) => {
  const sub: EmitterSubscription = DeviceEventEmitter.addListener(CHAT_SESSION_OPENED, listener);
  return () => sub.remove();
};

export const onChatSessionClosed = (listener: (payload: ChatSessionEvent) => void): (() => void) => {
  const sub: EmitterSubscription = DeviceEventEmitter.addListener(CHAT_SESSION_CLOSED, listener);
  return () => sub.remove();
};
