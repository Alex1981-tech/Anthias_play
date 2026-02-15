import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaTimes,
  FaBolt,
} from 'react-icons/fa'

import {
  AppDispatch,
  ScheduleSlot,
  ScheduleSlotItem,
} from '@/types'
import {
  removeSlotItem,
  updateSlotItem,
} from '@/store/schedule'
import Swal from 'sweetalert2'

import { SlotFormModal } from './slot-form-modal'
import { AddItemModal } from './add-item-modal'

interface SlotCardProps {
  slot: ScheduleSlot
  onDelete: (slotId: string, slotName: string) => void
  onUpdated: () => void
}

export const SlotCard = ({ slot, onDelete, onUpdated }: SlotCardProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)

  const formatTime = (timeStr: string) => {
    return timeStr ? timeStr.substring(0, 5) : ''
  }

  const getDayLabels = (days: number[]) => {
    return [...days]
      .sort((a, b) => a - b)
      .map((d) => t(`slots.days.${d}`))
      .join(', ')
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  const handleRemoveItem = async (item: ScheduleSlotItem) => {
    const result = await Swal.fire({
      title: t('common.areYouSure'),
      text: t('slots.removeItemConfirm', { name: item.asset_name }),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonText: t('common.cancel'),
      confirmButtonText: t('slots.remove'),
    })
    if (result.isConfirmed) {
      try {
        await dispatch(
          removeSlotItem({ slot_id: slot.slot_id, item_id: item.item_id }),
        ).unwrap()
        onUpdated()
      } catch {
        Swal.fire(t('common.error'), t('slots.removeItemFailed'), 'error')
      }
    }
  }

  const handleDurationChange = async (
    item: ScheduleSlotItem,
    newDuration: number | null,
  ) => {
    try {
      await dispatch(
        updateSlotItem({
          slot_id: slot.slot_id,
          item_id: item.item_id,
          duration_override: newDuration,
        }),
      ).unwrap()
      onUpdated()
    } catch {
      Swal.fire(t('common.error'), t('slots.updateFailed'), 'error')
    }
  }

  const handleItemAdded = () => {
    setIsAddItemModalOpen(false)
    onUpdated()
  }

  const handleSlotEdited = () => {
    setIsEditModalOpen(false)
    onUpdated()
  }

  return (
    <>
      <div className="mb-4">
        {/* Slot header */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <strong>{slot.name || t('slots.unnamed')}</strong>
            {slot.is_currently_active && (
              <span className="badge bg-success ms-2">{t('slots.active')}</span>
            )}
            {slot.is_default && (
              <span className="badge bg-warning text-dark ms-2">
                {t('slots.default')}
              </span>
            )}
            {slot.slot_type === 'event' && (
              <span className="badge bg-danger ms-2">
                <FaBolt className="me-1" style={{ fontSize: '0.7em' }} />
                {t('slots.eventSlot')}
              </span>
            )}
            {!slot.is_default && slot.slot_type !== 'event' && (
              <span className="ms-2" style={{ opacity: 0.7 }}>
                {formatTime(slot.time_from)} – {formatTime(slot.time_to)}
                {slot.days_of_week?.length > 0 && (
                  <span className="ms-2 small">
                    ({getDayLabels(slot.days_of_week)})
                  </span>
                )}
              </span>
            )}
            {slot.slot_type === 'event' && (
              <span className="ms-2" style={{ opacity: 0.7 }}>
                {formatTime(slot.time_from)}
                {slot.start_date && !slot.days_of_week?.length && (
                  <span className="ms-2 small">({slot.start_date})</span>
                )}
                {slot.days_of_week?.length > 0 && slot.days_of_week.length < 7 && (
                  <span className="ms-2 small">
                    ({getDayLabels(slot.days_of_week)})
                  </span>
                )}
                {slot.days_of_week?.length === 7 && (
                  <span className="ms-2 small">
                    ({t('slots.recurrenceDaily')})
                  </span>
                )}
              </span>
            )}
          </div>
          <div>
            <button
              className="btn btn-sm me-1"
              onClick={() => setIsEditModalOpen(true)}
              title={t('slots.edit')}
            >
              <FaEdit />
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onDelete(slot.slot_id, slot.name)}
              title={t('slots.delete')}
            >
              <FaTrash />
            </button>
          </div>
        </div>

        {/* Slot items table */}
        {slot.items.length === 0 ? (
          <p className="mb-2" style={{ opacity: 0.6 }}>{t('slots.noItems')}</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-borderless table-sm mb-2">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>{t('assets.name')}</th>
                  <th style={{ width: '100px' }}>{t('slots.type')}</th>
                  <th style={{ width: '140px' }}>{t('assets.duration')}</th>
                  <th style={{ width: '60px' }}>{t('assets.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {slot.items
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item, idx) => (
                    <tr key={item.item_id}>
                      <td style={{ opacity: 0.5 }}>{idx + 1}</td>
                      <td>{item.asset_name}</td>
                      <td>
                        <span className="badge bg-white bg-opacity-25">
                          {item.asset_mimetype?.split('/')[0] || '—'}
                        </span>
                      </td>
                      <td>
                        <DurationCell
                          item={item}
                          onDurationChange={handleDurationChange}
                          formatDuration={formatDuration}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleRemoveItem(item)}
                          title={t('slots.remove')}
                        >
                          <FaTimes />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          className="btn btn-sm"
          onClick={() => setIsAddItemModalOpen(true)}
        >
          <FaPlus className="me-1" />
          {t('slots.addItem')}
        </button>
      </div>

      <SlotFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={handleSlotEdited}
        existingSlot={slot}
      />

      <AddItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        onAdded={handleItemAdded}
        slot={slot}
      />
    </>
  )
}

// Inline editable duration cell
const DurationCell = ({
  item,
  onDurationChange,
  formatDuration,
}: {
  item: ScheduleSlotItem
  onDurationChange: (item: ScheduleSlotItem, dur: number | null) => void
  formatDuration: (s: number) => string
}) => {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(
    item.duration_override !== null
      ? String(item.duration_override)
      : '',
  )

  const handleSave = () => {
    const parsed = value.trim() === '' ? null : parseInt(value, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) return
    onDurationChange(item, parsed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="input-group input-group-sm">
        <input
          type="number"
          className="form-control form-control-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder={String(item.asset_duration)}
          autoFocus
          min="1"
          style={{ width: '70px' }}
        />
        <button
          className="btn btn-sm btn-outline-success"
          onClick={handleSave}
        >
          OK
        </button>
      </div>
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{ cursor: 'pointer' }}
      title={t('slots.clickToEditDuration')}
    >
      {formatDuration(item.effective_duration)}
      {item.duration_override !== null && (
        <span className="small ms-1" style={{ opacity: 0.6 }}>
          ({t('slots.overridden')})
        </span>
      )}
    </span>
  )
}
