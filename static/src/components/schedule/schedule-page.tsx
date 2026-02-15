import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { FaPlus, FaClock, FaStar, FaBolt } from 'react-icons/fa'
import Swal from 'sweetalert2'

import { AppDispatch } from '@/types'
import {
  fetchScheduleSlots,
  fetchScheduleStatus,
  deleteScheduleSlot,
  selectScheduleSlots,
  selectScheduleStatus,
  selectScheduleLoading,
  selectDefaultSlot,
  selectTimeSlots,
  selectEventSlots,
} from '@/store/schedule'

import { SlotCard } from './slot-card'
import { SlotFormModal } from './slot-form-modal'

export const SchedulePage = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const slots = useSelector(selectScheduleSlots)
  const status = useSelector(selectScheduleStatus)
  const loading = useSelector(selectScheduleLoading)
  const defaultSlot = useSelector(selectDefaultSlot)
  const timeSlots = useSelector(selectTimeSlots)
  const eventSlots = useSelector(selectEventSlots)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    document.title = t('slots.title')
    dispatch(fetchScheduleSlots())
    dispatch(fetchScheduleStatus())
  }, [dispatch, t])

  const handleCreateSlot = () => {
    setIsCreateModalOpen(true)
  }

  const handleDeleteSlot = async (slotId: string, slotName: string) => {
    const result = await Swal.fire({
      title: t('common.areYouSure'),
      text: t('slots.deleteConfirm', { name: slotName }),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonText: t('common.cancel'),
      confirmButtonText: t('slots.delete'),
    })
    if (result.isConfirmed) {
      try {
        await dispatch(deleteScheduleSlot(slotId)).unwrap()
        dispatch(fetchScheduleStatus())
      } catch {
        Swal.fire(t('common.error'), t('slots.deleteFailed'), 'error')
      }
    }
  }

  const handleSlotCreated = () => {
    setIsCreateModalOpen(false)
    dispatch(fetchScheduleSlots())
    dispatch(fetchScheduleStatus())
  }

  const handleSlotUpdated = () => {
    dispatch(fetchScheduleSlots())
    dispatch(fetchScheduleStatus())
  }

  const formatTime = (timeStr: string) => {
    return timeStr ? timeStr.substring(0, 5) : ''
  }

  return (
    <>
      <div className="container">
        <div className="row content active-content px-2 pt-4">
          <div className="col-12 mb-5">
            <section>
              {/* Header */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">
                  <FaClock className="me-2" />
                  {t('slots.title')}
                </h4>
                <button
                  className="btn btn-sm"
                  onClick={handleCreateSlot}
                >
                  <FaPlus className="me-1" />
                  {t('slots.addSlot')}
                </button>
              </div>

              {/* Status bar */}
              {status && status.schedule_enabled && (
                <div className="mb-3 px-2" style={{ opacity: 0.8 }}>
                  <strong>{t('slots.statusLabel')}:</strong>{' '}
                  {status.current_slot ? (
                    <>
                      {t('slots.activeNow')}: <strong>{status.current_slot.name}</strong>
                      {status.using_default && (
                        <span className="ms-2 badge bg-secondary">
                          {t('slots.default')}
                        </span>
                      )}
                      {status.next_change_at && (
                        <span className="ms-2">
                          ({t('slots.nextChange')}: {formatTime(
                            new Date(status.next_change_at).toLocaleTimeString('uk-UA', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          )})
                        </span>
                      )}
                    </>
                  ) : (
                    t('slots.noActiveSlot')
                  )}
                </div>
              )}

              {loading && slots.length === 0 && (
                <div className="text-center py-5">
                  <div className="spinner-border text-light" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              )}

              {!loading && slots.length === 0 && (
                <div className="text-center py-5" style={{ opacity: 0.7 }}>
                  <p className="mb-3">{t('slots.noSlots')}</p>
                  <button
                    className="btn btn-sm"
                    onClick={handleCreateSlot}
                  >
                    <FaPlus className="me-1" />
                    {t('slots.createFirst')}
                  </button>
                </div>
              )}

              {/* Default slot */}
              {defaultSlot && (
                <>
                  <h5 className="mb-2">
                    <FaStar className="me-2 text-warning" />
                    {t('slots.defaultSlot')}
                  </h5>
                  <SlotCard
                    slot={defaultSlot}
                    onDelete={handleDeleteSlot}
                    onUpdated={handleSlotUpdated}
                  />
                </>
              )}

              {/* Time-based slots */}
              {timeSlots.length > 0 && (
                <>
                  <h5 className="mb-2">
                    <FaClock className="me-2" />
                    {t('slots.timeSlots')}
                  </h5>
                  {timeSlots.map((slot) => (
                    <SlotCard
                      key={slot.slot_id}
                      slot={slot}
                      onDelete={handleDeleteSlot}
                      onUpdated={handleSlotUpdated}
                    />
                  ))}
                </>
              )}

              {/* Event slots */}
              {eventSlots.length > 0 && (
                <>
                  <h5 className="mb-2">
                    <FaBolt className="me-2 text-danger" />
                    {t('slots.eventSlots')}
                  </h5>
                  {eventSlots.map((slot) => (
                    <SlotCard
                      key={slot.slot_id}
                      slot={slot}
                      onDelete={handleDeleteSlot}
                      onUpdated={handleSlotUpdated}
                    />
                  ))}
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <SlotFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSaved={handleSlotCreated}
      />
    </>
  )
}
