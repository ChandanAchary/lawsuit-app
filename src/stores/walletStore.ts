import { create } from 'zustand';
import { walletApi } from '../services/api';
import { WalletTransaction, TransactionType } from '../types';

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  totalTransactions: number;
  currentPage: number;
  loading: boolean;
  error: string | null;
  fetchBalance: () => Promise<void>;
  fetchTransactions: (page?: number, limit?: number, type?: string) => Promise<void>;
  addMoney: (amount: number) => Promise<any>;
  confirmAddMoney: (data: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => Promise<void>;
  withdraw: (amount: number, bankAccountId?: string) => Promise<void>;
  transfer: (toUserId: string, amount: number, description?: string) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  transactions: [],
  totalTransactions: 0,
  currentPage: 1,
  loading: false,
  error: null,

  fetchBalance: async () => {
    try {
      const { data } = await walletApi.getBalance();
      set({ balance: data.balance ?? data.wallet?.balance ?? 0 });
    } catch {}
  },

  fetchTransactions: async (page = 1, limit = 20, type) => {
    set({ loading: true });
    try {
      const params: Record<string, unknown> = { page, limit };
      if (type) params.type = type;
      const { data } = await walletApi.getTransactions(params as any);
      set({
        transactions: data.items || data.transactions || [],
        totalTransactions: data.total || 0,
        currentPage: page,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  addMoney: async (amount) => {
    const { data } = await walletApi.addMoney(amount);
    return data;
  },

  confirmAddMoney: async (payload) => {
    await walletApi.confirmAddMoney(payload);
    get().fetchBalance();
    get().fetchTransactions();
  },

  withdraw: async (amount, bankAccountId) => {
    await walletApi.withdraw(amount, bankAccountId);
    get().fetchBalance();
    get().fetchTransactions();
  },

  transfer: async (toUserId, amount, description) => {
    await walletApi.transfer(toUserId, amount, description);
    get().fetchBalance();
    get().fetchTransactions();
  },
}));
