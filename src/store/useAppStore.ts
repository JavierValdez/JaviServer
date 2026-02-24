import { create } from 'zustand';
import { ServerProfile, ConnectionStatus, Tab, FileInfo } from '../types';

interface AppState {
  // Profiles
  profiles: ServerProfile[];
  selectedProfileId: string | null;
  
  // Connections
  connections: Map<string, ConnectionStatus>;
  
  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  
  // File Explorer
  currentPath: string;
  files: FileInfo[];
  loadingFiles: boolean;
  
  // Actions
  setProfiles: (profiles: ServerProfile[]) => void;
  addProfile: (profile: ServerProfile) => void;
  updateProfile: (id: string, data: Partial<ServerProfile>) => void;
  removeProfile: (id: string) => void;
  setSelectedProfileId: (id: string | null) => void;
  
  setConnectionStatus: (profileId: string, status: Partial<ConnectionStatus>) => void;
  
  addTab: (tab: Tab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  
  setCurrentPath: (path: string) => void;
  setFiles: (files: FileInfo[]) => void;
  setLoadingFiles: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  profiles: [],
  selectedProfileId: null,
  connections: new Map(),
  tabs: [],
  activeTabId: null,
  currentPath: '/',
  files: [],
  loadingFiles: false,
  
  // Profile actions
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
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId,
    })),
  
  setSelectedProfileId: (id) => set({ selectedProfileId: id }),
  
  // Connection actions
  setConnectionStatus: (profileId, status) =>
    set((state) => {
      const newConnections = new Map(state.connections);
      const existing = newConnections.get(profileId) || {
        profileId,
        connected: false,
        connecting: false,
      };
      newConnections.set(profileId, { ...existing, ...status });
      return { connections: newConnections };
    }),
  
  // Tab actions
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
  
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  
  // File explorer actions
  setCurrentPath: (path) => set({ currentPath: path }),
  setFiles: (files) => set({ files }),
  setLoadingFiles: (loading) => set({ loadingFiles: loading }),
}));
