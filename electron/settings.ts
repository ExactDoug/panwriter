import { defaultSettings, Settings } from '../src/appState/AppState'
import { readDataDirFile, writeDataDirFile } from './dataDir'

export const loadSettings = async (): Promise<Settings> => {
  const [data] = await readDataDirFile('settings.yaml')
  return parseSettings(data)
}

export const saveSettings = async (settings: Settings): Promise<void> => {
  await writeDataDirFile('settings.yaml', settings as unknown as Record<string, unknown>)
}

const parseSettings = (data: Record<string, unknown> = {}): Settings => {
  const { autoUpdateApp } = data
  return {
    autoUpdateApp: autoUpdateApp === undefined ? defaultSettings.autoUpdateApp : !!autoUpdateApp
  }
}
