import { RootState } from '@/types'

export const selectScheduleSlots = (state: RootState) =>
  state.schedule.slots

export const selectScheduleStatus = (state: RootState) =>
  state.schedule.status

export const selectScheduleLoading = (state: RootState) =>
  state.schedule.loading

export const selectScheduleError = (state: RootState) =>
  state.schedule.error

export const selectNonDefaultSlots = (state: RootState) =>
  state.schedule.slots
    .filter((s) => !s.is_default)
    .sort((a, b) => {
      if (a.time_from < b.time_from) return -1
      if (a.time_from > b.time_from) return 1
      return 0
    })

export const selectTimeSlots = (state: RootState) =>
  state.schedule.slots
    .filter((s) => !s.is_default && s.slot_type !== 'event')
    .sort((a, b) => {
      if (a.time_from < b.time_from) return -1
      if (a.time_from > b.time_from) return 1
      return 0
    })

export const selectEventSlots = (state: RootState) =>
  state.schedule.slots
    .filter((s) => s.slot_type === 'event')
    .sort((a, b) => {
      if (a.time_from < b.time_from) return -1
      if (a.time_from > b.time_from) return 1
      return 0
    })

export const selectDefaultSlot = (state: RootState) =>
  state.schedule.slots.find((s) => s.is_default) || null

export const selectScheduleEnabled = (state: RootState) =>
  state.schedule.slots.length > 0
