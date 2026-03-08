import { create } from 'zustand';
import { ServerProfile, ConnectionStatus, Tab } from '../types';

interface AppState {
  profiles: ServerProfile[];
  selectedProfileId: string | null;
  connections: Map<string, ConnectionStatus>;
  tabs: Tab[];
  activeTabId: string | null;
  setProfiles: (profiles: ServerProfile[]) => void;
  addProfile: (profile: ServerProfile) => void;
  updateProfile: (id: string, data: Partial<ServerProfile>) => void;
  removeProfile: (id: string) => void;
  setSelectedProfileId: (id: string | null) => void;
  setConnectionStatus: (profileId: string, status: Partial<ConnectionStatus>) => void;
  addTab: (tab: Tab) => void;
  removeTab: (tabId: string) => void;
  updateTabData: (tabId: string, data: NonNullable<Tab['data']>) => void;
  setActiveTab: (tabId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  profiles: [],
  selectedProfileId: null,
  connections: new Map(),
  tabs: [],
  activeTabId: null,
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) =>
    set((state) => ({ profiles: [...state.profiles, profile] })),
  updateProfile: (id, data) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    })),
  removeProfile: (id) =>
    set((state) => {
      const remainingTabs = state.tabs.filter((tab) => tab.profileId !== id);
      return {
        profiles: state.profiles.filter((p) => p.id !== id),
        selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId,
        connections: new Map([...state.connections].filter(([profileId]) => profileId !== id)),
        tabs: remainingTabs,
        activeTabId:
          state.activeTabId && remainingTabs.some((tab) => tab.id === state.activeTabId)
            ? state.activeTabId
            : remainingTabs.length > 0
              ? remainingTabs[remainingTabs.length - 1].id
              : null,
      };
    }),
  setSelectedProfileId: (id) => set({ selectedProfileId: id }),
  setConnectionStatus: (profileId, status) =>
    set((state) => {
      const newConnections = new Map(state.connections);
      const existing = newConnections.get(profileId) || {
        profileId,
        connected: false,
        connecting: false,
      };
      const nextStatus: ConnectionStatus = { ...existing, ...status };

      if ('error' in status) {
        if (!status.error) {
          delete nextStatus.error;
        }
      } else if ('connected' in status || 'connecting' in status) {
        delete nextStatus.error;
      }

      newConnections.set(profileId, nextStatus);
      return { connections: newConnections };
    }),
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),
  removeTab: (tabId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const newActiveTabId =
        state.activeTabId === tabId
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1].id
            : null
          : state.activeTabId;
      return { tabs: newTabs, activeTabId: newActiveTabId };
    }),

  updateTabData: (tabId, data) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              data: {
                ...tab.data,
                ...data,
              },
            }
          : tab,
      ),
    })),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
}));
