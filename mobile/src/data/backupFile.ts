/**
 * Moving a backup on and off the device.
 *
 * Sharing rather than a silent write to app storage: a backup inside the app's
 * own sandbox dies with the app. The point is to get the file somewhere the
 * athlete controls — Files, a cloud drive, an email to themselves.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { serializeBackup, type Backup } from './backup';

function filename(): string {
  return `athletiq-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export type ShareOutcome = 'shared' | 'unavailable';

/** Write the backup to a temporary file and hand it to the share sheet. */
export async function shareBackup(backup: Backup): Promise<ShareOutcome> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return 'unavailable';

  const uri = `${FileSystem.cacheDirectory}${filename()}`;
  await FileSystem.writeAsStringAsync(uri, serializeBackup(backup));
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your AthletIQ backup',
    UTI: 'public.json',
  });
  return 'shared';
}

/** Pick a backup file and return its contents. Undefined if cancelled. */
export async function pickBackupText(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return undefined;
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}
