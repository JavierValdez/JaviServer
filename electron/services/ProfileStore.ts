import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import type { PathBookmark, ServerProfile } from '../../src/types';

interface ProfileStoreSchema {
  profiles: ServerProfile[];
}

export interface ProfileInput {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: ServerProfile['authType'];
  credential: string;
}

const defaultPatterns: ServerProfile['logPatterns'] = [
  { pattern: 'SEVERE', color: '#ef4444', label: 'Severe' },
  { pattern: 'ERROR', color: '#ef4444', label: 'Error' },
  { pattern: 'WARN', color: '#f59e0b', label: 'Warning' },
  { pattern: 'WARNING', color: '#f59e0b', label: 'Warning' },
  { pattern: 'INFO', color: '#3b82f6', label: 'Info' },
  { pattern: 'DEBUG', color: '#6b7280', label: 'Debug' },
  { pattern: 'Exception', color: '#dc2626', label: 'Exception' },
];

function normalizeProfile(profile: ServerProfile): ServerProfile {
  return {
    ...profile,
    port: profile.port || 22,
    bookmarks: Array.isArray(profile.bookmarks) ? profile.bookmarks : [],
    logPatterns: Array.isArray(profile.logPatterns) && profile.logPatterns.length > 0
      ? profile.logPatterns
      : defaultPatterns,
  };
}

export class ProfileStore {
  private readonly store = new Store<ProfileStoreSchema>({
    name: 'server-profiles',
    defaults: {
      profiles: [],
    },
  });

  getAll(): ServerProfile[] {
    return this.store.get('profiles', []).map(normalizeProfile);
  }

  get(profileId: string): ServerProfile | undefined {
    return this.getAll().find((profile) => profile.id === profileId);
  }

  create(input: ProfileInput): ServerProfile {
    const profiles = this.getAll();
    const profile: ServerProfile = normalizeProfile({
      id: randomUUID(),
      name: input.name.trim(),
      host: input.host.trim(),
      port: input.port || 22,
      username: input.username.trim(),
      authType: input.authType,
      credential: input.credential,
      bookmarks: [],
      logPatterns: defaultPatterns,
    });

    this.store.set('profiles', [...profiles, profile]);
    return profile;
  }

  update(profileId: string, updates: Partial<ProfileInput>): ServerProfile {
    const profiles = this.getAll();
    const profile = profiles.find((item) => item.id === profileId);

    if (!profile) {
      throw new Error('El perfil solicitado no existe.');
    }

    const nextProfile = normalizeProfile({
      ...profile,
      ...updates,
      name: updates.name?.trim() ?? profile.name,
      host: updates.host?.trim() ?? profile.host,
      username: updates.username?.trim() ?? profile.username,
      credential: updates.credential ?? profile.credential,
    });

    this.store.set(
      'profiles',
      profiles.map((item) => item.id === profileId ? nextProfile : item),
    );

    return nextProfile;
  }

  delete(profileId: string): void {
    this.store.set(
      'profiles',
      this.getAll().filter((profile) => profile.id !== profileId),
    );
  }

  addBookmark(profileId: string, bookmark: Omit<PathBookmark, 'id'>): PathBookmark {
    const profile = this.get(profileId);

    if (!profile) {
      throw new Error('No se encontró el perfil para guardar el bookmark.');
    }

    const nextBookmark: PathBookmark = {
      id: randomUUID(),
      name: bookmark.name.trim(),
      path: bookmark.path,
      isLogDirectory: bookmark.isLogDirectory,
    };

    const updatedProfile = {
      ...profile,
      bookmarks: [...profile.bookmarks, nextBookmark],
    };

    this.store.set(
      'profiles',
      this.getAll().map((item) => item.id === profileId ? updatedProfile : item),
    );

    return nextBookmark;
  }

  removeBookmark(profileId: string, bookmarkId: string): void {
    const profile = this.get(profileId);

    if (!profile) {
      throw new Error('No se encontró el perfil para eliminar el bookmark.');
    }

    const updatedProfile = {
      ...profile,
      bookmarks: profile.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
    };

    this.store.set(
      'profiles',
      this.getAll().map((item) => item.id === profileId ? updatedProfile : item),
    );
  }
}
