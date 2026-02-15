// Centralized type definitions for the Anthias application
import { store } from '@/store/index'

// Asset-related types
export interface Asset {
  asset_id: string
  name: string
  start_date: string
  end_date: string
  duration: number
  uri: string
  mimetype: string
  is_enabled: number
  nocache: boolean
  skip_asset_check: boolean
  is_active: boolean
  play_order: number
  is_processing: boolean
}

export interface AssetEditData {
  id: string
  name: string
  start_date: string
  end_date: string
  duration: number
  uri: string
  mimetype: string
  is_enabled: boolean
  nocache: boolean
  skip_asset_check: boolean
  play_order?: number
}

export interface EditFormData {
  name: string
  start_date: string
  end_date: string
  duration: string
  mimetype: string
  nocache: boolean
  skip_asset_check: boolean
}

export interface HandleSubmitParams {
  e: React.FormEvent
  asset: AssetEditData
  formData: EditFormData
  startDateDate: string
  startDateTime: string
  endDateDate: string
  endDateTime: string
  dispatch: AppDispatch
  onClose: () => void
  setIsSubmitting: (isSubmitting: boolean) => void
}

// WebSocket-related types
export interface WebSocketMessage {
  type?: string
  data?: unknown
  asset_id?: string
}

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastMessage: WebSocketMessage | string | null
  reconnectAttempts: number
}

export interface ExtendedWindow extends Window {
  anthiasWebSocket?: WebSocket
}

// Schedule-related types
export type SlotType = 'default' | 'time' | 'event'

export interface ScheduleSlot {
  slot_id: string
  name: string
  slot_type: SlotType
  time_from: string  // "HH:MM:SS"
  time_to: string    // "HH:MM:SS"
  days_of_week: number[]  // 1=Mon .. 7=Sun
  is_default: boolean
  start_date: string | null
  end_date: string | null
  no_loop: boolean
  sort_order: number
  items: ScheduleSlotItem[]
  is_currently_active: boolean
}

export interface ScheduleSlotItem {
  item_id: string
  slot_id: string
  asset_id: string
  sort_order: number
  duration_override: number | null
  asset_name: string
  asset_uri: string
  asset_mimetype: string
  asset_duration: number
  effective_duration: number
}

export interface ScheduleStatus {
  schedule_enabled: boolean
  current_slot: ScheduleSlot | null
  next_change_at: string | null
  total_slots: number
  using_default: boolean
}

export interface CreateSlotData {
  name: string
  slot_type: SlotType
  time_from?: string
  time_to?: string
  days_of_week?: number[]
  is_default: boolean
  start_date?: string | null
  end_date?: string | null
  no_loop?: boolean
}

export interface UpdateSlotData {
  slot_id: string
  name?: string
  slot_type?: SlotType
  time_from?: string
  time_to?: string
  days_of_week?: number[]
  is_default?: boolean
  start_date?: string | null
  end_date?: string | null
  no_loop?: boolean
}

export interface AddSlotItemData {
  slot_id: string
  asset_id: string
  sort_order?: number
  duration_override?: number | null
}

export interface ScheduleState {
  slots: ScheduleSlot[]
  status: ScheduleStatus | null
  loading: boolean
  error: string | null
}

// Redux store types
export interface RootState {
  assets: {
    items: Asset[]
    status: 'idle' | 'loading' | 'succeeded' | 'failed'
    error: string | null
  }
  assetModal: {
    activeTab: string
    formData: {
      uri: string
      skipAssetCheck: boolean
      name?: string
      mimetype?: string
      duration?: number
      dates?: {
        start_date: string
        end_date: string
      }
    }
    isValid: boolean
    errorMessage: string
    statusMessage: string
    uploadProgress: number
    isSubmitting: boolean
  }
  settings: {
    settings: {
      playerName: string
      defaultDuration: number
      defaultStreamingDuration: number
      audioOutput: string
      dateFormat: string
      resolution: string
      authBackend: string
      currentPassword: string
      user: string
      password: string
      confirmPassword: string
      showSplash: boolean
      defaultAssets: boolean
      shufflePlaylist: boolean
      use24HourClock: boolean
      debugLogging: boolean
      displayPowerSchedule: DisplayPowerSchedule
      language: string
    }
    deviceModel: string
    prevAuthBackend: string
    hasSavedBasicAuth: boolean
    isLoading: boolean
    isUploading: boolean
    uploadProgress: number
    error: string | null
  }
  websocket: WebSocketState
  schedule: ScheduleState
}

// Component prop types
export interface ActiveAssetsTableProps {
  onEditAsset: (asset: AssetEditData) => void
}

export interface InactiveAssetsTableProps {
  onEditAsset: (asset: AssetEditData) => void
}

export interface AssetRowProps {
  assetId: string
  name: string
  startDate: string
  endDate: string
  duration: number
  uri: string
  mimetype: string
  isEnabled: boolean
  nocache: boolean
  skipAssetCheck: boolean
  isProcessing?: number
  style?: React.CSSProperties
  showDragHandle?: boolean
  hideActivityToggle?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  isDragging?: boolean
  onEditAsset?: (asset: AssetEditData) => void
}

// Settings-related types
export interface DisplayPowerSchedule {
  enabled: boolean
  days: Record<string, { on: string; off: string } | null>
}

export interface SettingsData {
  playerName: string
  defaultDuration: number
  defaultStreamingDuration: number
  audioOutput: string
  dateFormat: string
  resolution: string
  authBackend: string
  currentPassword: string
  user: string
  password: string
  confirmPassword: string
  showSplash: boolean
  defaultAssets: boolean
  shufflePlaylist: boolean
  use24HourClock: boolean
  debugLogging: boolean
  displayPowerSchedule: DisplayPowerSchedule
  language: string
}

export interface SystemOperationParams {
  operation: string
  endpoint: string
  successMessage: string
}

export interface OperationConfig {
  operation?: string
  endpoint: string
  successMessage: string
  confirmMessage?: string
  title?: string
  text?: string
  confirmButtonText?: string
  errorMessage?: string
}

// Asset modal types
export interface UploadFileParams {
  file: File
  skipAssetCheck: boolean
}

export interface SaveAssetParams {
  assetData: {
    duration: number
    end_date: string
    is_active: number
    is_enabled: number
    is_processing: number
    mimetype: string
    name: string
    nocache: number
    play_order: number
    skip_asset_check: number
    start_date: string
    uri: string
  }
}

export interface FileData {
  uri: string
  ext: string
}

export interface FormData {
  uri: string
  skipAssetCheck: boolean
  name?: string
  mimetype?: string
  duration?: number
  dates?: {
    start_date: string
    end_date: string
  }
}

// Redux Toolkit types
export type AppDispatch = typeof store.dispatch
export type AsyncThunkAction = ReturnType<typeof store.dispatch>

// Asset thunk types
export interface ToggleAssetParams {
  assetId: string
  newValue: number
}

// System info types
export interface AnthiasVersionValueProps {
  version: string
}

export interface SkeletonProps {
  children: React.ReactNode
  isLoading: boolean
}

export interface MemoryInfo {
  total: number
  used: number
  free: number
  shared: number
  buff: number
  available: number
  percentage?: number
}

export interface UptimeInfo {
  days: number
  hours: number
  minutes?: number
  seconds?: number
}

export interface SystemInfoResponse {
  loadavg: number
  free_space: string
  display_power: string
  uptime: UptimeInfo
  memory: MemoryInfo
  device_model: string
  anthias_version: string
  mac_address: string
  ip_addresses?: string[]
  host_user?: string
}

export interface DeviceSettingsResponse {
  player_name: string
}

export interface IntegrationsResponse {
  is_balena: boolean
}
