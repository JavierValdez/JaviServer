import { create } from 'zustand';
import { ServerProfile, ConnectionStatus, Tab } from '../types';

function findLatestTabIdForProfile(tabs: Tab[], profileId: string | null): string | null {
  if (!profileId) {
    return null;
  }

  for (let index = tabs.length - 1; index >= 0; index -= 1) {
    if (tabs[index].profileId === profileId) {
      return tabs[index].id;
    }
  }

  return null;
}

function resolveActiveTabIdForProfile(
  tabs: Tab[],
  profileId: string | null,
  activeTabIdByProfile: Record<string, string | null>,
): string | null {
  if (!profileId) {
    return null;
  }

  const rememberedTabId = activeTabIdByProfile[profileId];
  if (rememberedTabId && tabs.some((tab) => tab.id === rememberedTabId && tab.profileId === profileId)) {
    return rememberedTabId;
  }

  return findLatestTabIdForProfile(tabs, profileId);
}

interface AppState {
  profiles: ServerProfile[];
  selectedProfileId: string | null;
  connections: Map<string, ConnectionStatus>;
  tabs: Tab[];
  activeTabId: string | null;
  activeTabIdByProfile: Record<string, string | null>;
  setProfiles: (profiles: ServerProfile[]) => void;
  addProfile: (profile: ServerProfile) => void;
  updateProfile: (id: string, data: Partial<ServerProfile>) => void;
  removeProfile: (id: string) => void;
  setSelectedProfileId: (id: string | null) => void;
  setConnectionStatus: (profileId: string, status: Partial<ConnectionStatus>) => void;
  addTab: (tab: Tab) => void;
  removeTab: (tabId: string) => void;
  reorderTabs: (draggedTabId: string, targetTabId: string) => void;
  updateTabData: (tabId: string, data: NonNullable<Tab['data']>) => void;
  setActiveTab: (tabId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  profiles: [],
  selectedProfileId: null,
  connections: new Map(),
  tabs: [],
  activeTabId: null,
  activeTabIdByProfile: {},
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
      const nextSelectedProfileId = state.selectedProfileId === id ? null : state.selectedProfileId;
      const { [id]: _removedTabId, ...remainingActiveTabIdByProfile } = state.activeTabIdByProfile;

      return {
        profiles: state.profiles.filter((p) => p.id !== id),
        selectedProfileId: nextSelectedProfileId,
        connections: new Map([...state.connections].filter(([profileId]) => profileId !== id)),
        tabs: remainingTabs,
        activeTabIdByProfile: remainingActiveTabIdByProfile,
        activeTabId: resolveActiveTabIdForProfile(remainingTabs, nextSelectedProfileId, remainingActiveTabIdByProfile),
      };
    }),
  setSelectedProfileId: (id) =>
    set((state) => ({
      selectedProfileId: id,
      activeTabId: resolveActiveTabIdForProfile(state.tabs, id, state.activeTabIdByProfile),
    })),
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
      selectedProfileId: tab.profileId,
      activeTabId: tab.id,
      activeTabIdByProfile: {
        ...state.activeTabIdByProfile,
        [tab.profileId]: tab.id,
      },
    })),
  removeTab: (tabId) =>
    set((state) => {
      const removedTab = state.tabs.find((tab) => tab.id === tabId);
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const nextActiveTabIdByProfile = { ...state.activeTabIdByProfile };

      if (removedTab && nextActiveTabIdByProfile[removedTab.profileId] === tabId) {
        const nextProfileTabId = findLatestTabIdForProfile(newTabs, removedTab.profileId);
        if (nextProfileTabId) {
          nextActiveTabIdByProfile[removedTab.profileId] = nextProfileTabId;
        } else {
          delete nextActiveTabIdByProfile[removedTab.profileId];
        }
      }

      return {
        tabs: newTabs,
        activeTabIdByProfile: nextActiveTabIdByProfile,
        activeTabId: resolveActiveTabIdForProfile(newTabs, state.selectedProfileId, nextActiveTabIdByProfile),
      };
    }),
  reorderTabs: (draggedTabId, targetTabId) =>
    set((state) => {
      if (draggedTabId === targetTabId) {
        return state;
      }

      const sourceIndex = state.tabs.findIndex((tab) => tab.id === draggedTabId);
      const targetIndex = state.tabs.findIndex((tab) => tab.id === targetTabId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return state;
      }

      const reorderedTabs = [...state.tabs];
      const [draggedTab] = reorderedTabs.splice(sourceIndex, 1);
      reorderedTabs.splice(targetIndex, 0, draggedTab);

      return { tabs: reorderedTabs };
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
  setActiveTab: (tabId) =>
    set((state) => {
      const tab = state.tabs.find((entry) => entry.id === tabId);
      if (!tab) {
        return state;
      }

      return {
        selectedProfileId: tab.profileId,
        activeTabId: tabId,
        activeTabIdByProfile: {
          ...state.activeTabIdByProfile,
          [tab.profileId]: tabId,
        },
      };
    }),
}));
