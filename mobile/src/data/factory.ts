/**
 * Picks the storage backend for the current platform. SQLite on device,
 * localStorage on web — expo-sqlite has no web implementation.
 */
import { Platform } from 'react-native';
import type { Repository } from './repository';
import { SqliteRepository } from './sqlite';
import { WebRepository, WebRosterRepository } from './webStorage';
import { InMemoryRosterRepository, type RosterRepository } from './rosterRepository';

export function createRepository(): Repository {
  return Platform.OS === 'web' ? new WebRepository() : new SqliteRepository();
}

/**
 * The roster has no SQLite backing yet — a coach squad syncs from a server in
 * any real deployment, so persisting it locally would be the wrong shape to
 * build on. Web gets localStorage so the screen is usable in development.
 */
export function createRosterRepository(): RosterRepository {
  return Platform.OS === 'web' ? new WebRosterRepository() : new InMemoryRosterRepository();
}
