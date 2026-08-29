/**
 * Picks the storage backend for the current platform. SQLite on device,
 * localStorage on web — expo-sqlite has no web implementation.
 */
import { Platform } from 'react-native';
import type { Repository } from './repository';
import { SqliteRepository } from './sqlite';
import { WebRepository } from './webStorage';

export function createRepository(): Repository {
  return Platform.OS === 'web' ? new WebRepository() : new SqliteRepository();
}
