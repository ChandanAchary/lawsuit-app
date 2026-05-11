import { create } from 'zustand';

// =============================================================================
// activeCallStore — survives the VideoCallScreen unmount so the user can
// minimize an in-progress call (back to chat / device back / app background)
// without ending it. The chat header reads from this store to show a
// "Tap to return to call" banner whenever the active call's `otherUserId`
// matches the chat's peer.
//
// LIFECYCLE OWNERSHIP:
//   - VideoCallScreen.setActive(...) when the call goes live (call:initiated
//     ack on outgoing, or accepted-incoming-call mounts with route params).
//   - VideoCallScreen.clear() ONLY when Daily's Leave button is pressed
//     (WebView posts `left`), the socket reports `call:declined`,
//     `call:cancelled`, `call:ended`, or `call:error`.
//   - Plain back-navigation (chevron in VideoCallScreen, device back gesture)
//     leaves the store untouched — that's the "minimize" affordance.
//
// Because the source of truth is global, both the caller and the callee can
// minimize the call independently and return to it later from chat. Daily's
// room stays alive for ~2 hours per meeting-token, which is the floor for
// how long a minimized call is resumable.
// =============================================================================

export type ActiveCallOtherUser = {
  id: string;
  name?: string;
  avatarUrl?: string;
};

export type ActiveCall = {
  callId: string;
  roomUrl: string;
  token: string;
  mediaType: 'audio' | 'video';
  otherUser: ActiveCallOtherUser;
  // referenceId is either a chatId or an appointmentId; the kind is implied
  // by which of `chatId` / `appointmentId` is set below.
  chatId?: string;
  appointmentId?: string;
  isOutgoing: boolean;
  startedAt: number; // ms epoch when the call was first activated locally
};

interface ActiveCallStore {
  call: ActiveCall | null;
  setActive: (call: ActiveCall) => void;
  clear: () => void;
  // Convenience: returns the active call iff it's bound to `chatId`.
  // Used by ChatScreen to decide whether to show the resume banner.
  getActiveForChat: (chatId: string) => ActiveCall | null;
}

export const useActiveCallStore = create<ActiveCallStore>((set, get) => ({
  call: null,
  setActive: (call) => set({ call }),
  clear: () => set({ call: null }),
  getActiveForChat: (chatId) => {
    const current = get().call;
    if (!current) return null;
    if (current.chatId && current.chatId === chatId) return current;
    return null;
  },
}));

export default useActiveCallStore;
