import { createSlice } from '@reduxjs/toolkit'
import { ScheduleState } from '@/types'
import {
  fetchScheduleSlots,
  fetchScheduleStatus,
  createScheduleSlot,
  updateScheduleSlot,
  deleteScheduleSlot,
  addSlotItem,
  removeSlotItem,
  updateSlotItemOrder,
  updateSlotItem,
} from './schedule-thunks'

const initialState: ScheduleState = {
  slots: [],
  status: null,
  loading: false,
  error: null,
}

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    clearScheduleError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchScheduleSlots
      .addCase(fetchScheduleSlots.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchScheduleSlots.fulfilled, (state, action) => {
        state.loading = false
        state.slots = action.payload
      })
      .addCase(fetchScheduleSlots.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch slots'
      })

      // fetchScheduleStatus
      .addCase(fetchScheduleStatus.fulfilled, (state, action) => {
        state.status = action.payload
      })

      // createScheduleSlot
      .addCase(createScheduleSlot.fulfilled, (state, action) => {
        state.slots.push(action.payload)
      })
      .addCase(createScheduleSlot.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create slot'
      })

      // updateScheduleSlot
      .addCase(updateScheduleSlot.fulfilled, (state, action) => {
        const idx = state.slots.findIndex(
          (s) => s.slot_id === action.payload.slot_id,
        )
        if (idx !== -1) {
          state.slots[idx] = action.payload
        }
      })
      .addCase(updateScheduleSlot.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update slot'
      })

      // deleteScheduleSlot
      .addCase(deleteScheduleSlot.fulfilled, (state, action) => {
        state.slots = state.slots.filter(
          (s) => s.slot_id !== action.payload,
        )
      })

      // addSlotItem
      .addCase(addSlotItem.fulfilled, (state, action) => {
        const slot = state.slots.find(
          (s) => s.slot_id === action.payload.slot_id,
        )
        if (slot) {
          slot.items.push(action.payload.item)
        }
      })
      .addCase(addSlotItem.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to add item'
      })

      // removeSlotItem
      .addCase(removeSlotItem.fulfilled, (state, action) => {
        const slot = state.slots.find(
          (s) => s.slot_id === action.payload.slot_id,
        )
        if (slot) {
          slot.items = slot.items.filter(
            (i) => i.item_id !== action.payload.item_id,
          )
        }
      })

      // updateSlotItemOrder
      .addCase(updateSlotItemOrder.fulfilled, (state, action) => {
        const slot = state.slots.find(
          (s) => s.slot_id === action.payload.slot_id,
        )
        if (slot) {
          slot.items = action.payload.items
        }
      })

      // updateSlotItem
      .addCase(updateSlotItem.fulfilled, (state, action) => {
        const slot = state.slots.find(
          (s) => s.slot_id === action.payload.slot_id,
        )
        if (slot) {
          const idx = slot.items.findIndex(
            (i) => i.item_id === action.payload.item.item_id,
          )
          if (idx !== -1) {
            slot.items[idx] = action.payload.item
          }
        }
      })
  },
})

export const { clearScheduleError } = scheduleSlice.actions
export default scheduleSlice.reducer
