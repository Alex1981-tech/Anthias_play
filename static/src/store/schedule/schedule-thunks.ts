import { createAsyncThunk } from '@reduxjs/toolkit'
import {
  ScheduleSlot,
  ScheduleStatus,
  CreateSlotData,
  UpdateSlotData,
  AddSlotItemData,
  ScheduleSlotItem,
} from '@/types'

export const fetchScheduleSlots = createAsyncThunk(
  'schedule/fetchSlots',
  async () => {
    const response = await fetch('/api/v2/schedule/slots')
    if (!response.ok) {
      throw new Error('Failed to fetch schedule slots')
    }
    const data: ScheduleSlot[] = await response.json()
    return data
  },
)

export const fetchScheduleStatus = createAsyncThunk(
  'schedule/fetchStatus',
  async () => {
    const response = await fetch('/api/v2/schedule/status')
    if (!response.ok) {
      throw new Error('Failed to fetch schedule status')
    }
    const data: ScheduleStatus = await response.json()
    return data
  },
)

export const createScheduleSlot = createAsyncThunk(
  'schedule/createSlot',
  async (slotData: CreateSlotData) => {
    const response = await fetch('/api/v2/schedule/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slotData),
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(
        typeof err === 'object'
          ? Object.values(err).flat().join('; ')
          : 'Failed to create slot',
      )
    }
    const data: ScheduleSlot = await response.json()
    return data
  },
)

export const updateScheduleSlot = createAsyncThunk(
  'schedule/updateSlot',
  async ({ slot_id, ...updates }: UpdateSlotData) => {
    const response = await fetch(`/api/v2/schedule/slots/${slot_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(
        typeof err === 'object'
          ? Object.values(err).flat().join('; ')
          : 'Failed to update slot',
      )
    }
    const data: ScheduleSlot = await response.json()
    return data
  },
)

export const deleteScheduleSlot = createAsyncThunk(
  'schedule/deleteSlot',
  async (slotId: string) => {
    const response = await fetch(`/api/v2/schedule/slots/${slotId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete slot')
    }
    return slotId
  },
)

export const addSlotItem = createAsyncThunk(
  'schedule/addSlotItem',
  async ({ slot_id, ...itemData }: AddSlotItemData) => {
    const response = await fetch(
      `/api/v2/schedule/slots/${slot_id}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      },
    )
    if (!response.ok) {
      const err = await response.json()
      throw new Error(
        typeof err === 'object'
          ? (err.error || Object.values(err).flat().join('; '))
          : 'Failed to add item',
      )
    }
    const data: ScheduleSlotItem = await response.json()
    return { slot_id, item: data }
  },
)

export const removeSlotItem = createAsyncThunk(
  'schedule/removeSlotItem',
  async ({ slot_id, item_id }: { slot_id: string; item_id: string }) => {
    const response = await fetch(
      `/api/v2/schedule/slots/${slot_id}/items/${item_id}`,
      { method: 'DELETE' },
    )
    if (!response.ok) {
      throw new Error('Failed to remove item')
    }
    return { slot_id, item_id }
  },
)

export const updateSlotItemOrder = createAsyncThunk(
  'schedule/updateSlotItemOrder',
  async ({ slot_id, ids }: { slot_id: string; ids: string[] }) => {
    const response = await fetch(
      `/api/v2/schedule/slots/${slot_id}/items/order`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      },
    )
    if (!response.ok) {
      throw new Error('Failed to reorder items')
    }
    const items: ScheduleSlotItem[] = await response.json()
    return { slot_id, items }
  },
)

export const updateSlotItem = createAsyncThunk(
  'schedule/updateSlotItem',
  async ({
    slot_id,
    item_id,
    duration_override,
  }: {
    slot_id: string
    item_id: string
    duration_override: number | null
  }) => {
    const response = await fetch(
      `/api/v2/schedule/slots/${slot_id}/items/${item_id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_override }),
      },
    )
    if (!response.ok) {
      throw new Error('Failed to update item')
    }
    const data: ScheduleSlotItem = await response.json()
    return { slot_id, item: data }
  },
)
