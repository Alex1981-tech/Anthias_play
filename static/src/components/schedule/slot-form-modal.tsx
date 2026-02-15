import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import classNames from 'classnames'
import Swal from 'sweetalert2'
import { FaStar, FaClock, FaBolt } from 'react-icons/fa'

import {
  AppDispatch,
  ScheduleSlot,
  SlotType,
  CreateSlotData,
  UpdateSlotData,
} from '@/types'
import {
  createScheduleSlot,
  updateScheduleSlot,
} from '@/store/schedule'
import { SWEETALERT_TIMER } from '@/constants'

interface SlotFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  existingSlot?: ScheduleSlot
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

export const SlotFormModal = ({
  isOpen,
  onClose,
  onSaved,
  existingSlot,
}: SlotFormModalProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const isEditing = !!existingSlot

  const getInitialType = (): SlotType | null => {
    if (!existingSlot) return null
    if (existingSlot.slot_type) return existingSlot.slot_type
    if (existingSlot.is_default) return 'default'
    return 'time'
  }

  const [slotType, setSlotType] = useState<SlotType | null>(null)
  const [name, setName] = useState('')
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('18:00')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(ALL_DAYS)
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'weekly'>('once')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      if (existingSlot) {
        setSlotType(getInitialType())
        setName(existingSlot.name)
        setTimeFrom(existingSlot.time_from.substring(0, 5))
        setTimeTo(existingSlot.time_to.substring(0, 5))
        setDaysOfWeek([...existingSlot.days_of_week])
        setStartDate(existingSlot.start_date || '')
        setEndDate(existingSlot.end_date || '')
        // Determine recurrence mode for event slots
        if (existingSlot.slot_type === 'event') {
          if (existingSlot.start_date && (!existingSlot.days_of_week?.length)) {
            setRecurrence('once')
          } else if (existingSlot.days_of_week?.length === 7) {
            setRecurrence('daily')
          } else {
            setRecurrence('weekly')
          }
        }
      } else {
        setSlotType(null)
        setName('')
        setTimeFrom('09:00')
        setTimeTo('18:00')
        setDaysOfWeek([...ALL_DAYS])
        setRecurrence('once')
        setStartDate('')
        setEndDate('')
      }
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, existingSlot])

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const canSubmit = () => {
    if (!slotType || !name.trim()) return false
    if (slotType === 'time' && daysOfWeek.length === 0) return false
    if (slotType === 'event' && recurrence === 'weekly' && daysOfWeek.length === 0) return false
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slotType) return
    setIsSubmitting(true)

    try {
      if (isEditing && existingSlot) {
        const updates: UpdateSlotData = {
          slot_id: existingSlot.slot_id,
          name,
          slot_type: slotType,
          is_default: slotType === 'default',
        }
        if (slotType === 'time') {
          updates.time_from = timeFrom
          updates.time_to = timeTo
          updates.days_of_week = daysOfWeek
        }
        if (slotType === 'event') {
          updates.time_from = timeFrom
          updates.no_loop = true
          if (recurrence === 'once') {
            updates.start_date = startDate || null
            updates.days_of_week = []
          } else if (recurrence === 'daily') {
            updates.days_of_week = [...ALL_DAYS]
            updates.start_date = startDate || null
            updates.end_date = endDate || null
          } else {
            updates.days_of_week = daysOfWeek
            updates.start_date = startDate || null
            updates.end_date = endDate || null
          }
        }
        await dispatch(updateScheduleSlot(updates)).unwrap()
      } else {
        const slotData: CreateSlotData = {
          name,
          slot_type: slotType,
          is_default: slotType === 'default',
        }
        if (slotType === 'time') {
          slotData.time_from = timeFrom
          slotData.time_to = timeTo
          slotData.days_of_week = daysOfWeek
        }
        if (slotType === 'event') {
          slotData.time_from = timeFrom
          slotData.no_loop = true
          if (recurrence === 'once') {
            slotData.start_date = startDate || null
            slotData.days_of_week = []
          } else if (recurrence === 'daily') {
            slotData.days_of_week = [...ALL_DAYS]
            slotData.start_date = startDate || null
            slotData.end_date = endDate || null
          } else {
            slotData.days_of_week = daysOfWeek
            slotData.start_date = startDate || null
            slotData.end_date = endDate || null
          }
        }
        await dispatch(createScheduleSlot(slotData)).unwrap()
      }

      await Swal.fire({
        title: t('common.success'),
        icon: 'success',
        timer: SWEETALERT_TIMER,
        showConfirmButton: false,
      })
      onSaved()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('slots.saveFailed')
      Swal.fire(t('common.error'), message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Type selection step ──
  const renderTypeSelection = () => (
    <div className="d-flex flex-column gap-3">
      <button
        type="button"
        className="btn btn-outline-secondary text-start p-3 d-flex align-items-start gap-3"
        onClick={() => setSlotType('default')}
      >
        <FaStar className="text-warning mt-1" style={{ fontSize: '1.5rem', flexShrink: 0 }} />
        <div>
          <div className="fw-bold">{t('slots.slotTypeDefault')}</div>
          <small className="text-muted">{t('slots.slotTypeDefaultDesc')}</small>
        </div>
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary text-start p-3 d-flex align-items-start gap-3"
        onClick={() => setSlotType('time')}
      >
        <FaClock className="text-primary mt-1" style={{ fontSize: '1.5rem', flexShrink: 0 }} />
        <div>
          <div className="fw-bold">{t('slots.slotTypeTime')}</div>
          <small className="text-muted">{t('slots.slotTypeTimeDesc')}</small>
        </div>
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary text-start p-3 d-flex align-items-start gap-3"
        onClick={() => { setSlotType('event'); setRecurrence('once') }}
      >
        <FaBolt className="text-danger mt-1" style={{ fontSize: '1.5rem', flexShrink: 0 }} />
        <div>
          <div className="fw-bold">{t('slots.slotTypeEvent')}</div>
          <small className="text-muted">{t('slots.slotTypeEventDesc')}</small>
        </div>
      </button>
    </div>
  )

  // ── Default form ──
  const renderDefaultForm = () => (
    <div className="mb-3">
      <label className="form-label fw-semibold">{t('slots.slotName')}</label>
      <input
        type="text"
        className="form-control"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('slots.slotNamePlaceholder')}
        required
      />
      <div className="form-text mt-2">{t('slots.defaultHint')}</div>
    </div>
  )

  // ── Time form ──
  const renderTimeForm = () => (
    <>
      <div className="mb-3">
        <label className="form-label fw-semibold">{t('slots.slotName')}</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('slots.slotNamePlaceholder')}
          required
        />
      </div>
      <div className="row mb-3">
        <div className="col-6">
          <label className="form-label fw-semibold">{t('slots.timeFrom')}</label>
          <input
            type="time"
            className="form-control"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            required
          />
        </div>
        <div className="col-6">
          <label className="form-label fw-semibold">{t('slots.timeTo')}</label>
          <input
            type="time"
            className="form-control"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">{t('slots.daysOfWeek')}</label>
        <div className="d-flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className={classNames('btn', 'btn-sm',
                daysOfWeek.includes(d) ? 'btn-primary' : 'btn-outline-secondary',
              )}
              onClick={() => toggleDay(d)}
            >
              {t(`slots.days.${d}`)}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  // ── Event form ──
  const renderEventForm = () => (
    <>
      <div className="mb-3">
        <label className="form-label fw-semibold">{t('slots.slotName')}</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('slots.slotNamePlaceholder')}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label fw-semibold">{t('slots.timeFrom')}</label>
        <input
          type="time"
          className="form-control"
          value={timeFrom}
          onChange={(e) => setTimeFrom(e.target.value)}
          required
        />
        <div className="form-text">{t('slots.autoEndTime')}</div>
      </div>

      {/* Recurrence */}
      <div className="mb-3">
        <label className="form-label fw-semibold">{t('slots.recurrence')}</label>
        <div className="d-flex gap-2">
          {(['once', 'daily', 'weekly'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={classNames('btn', 'btn-sm',
                recurrence === r ? 'btn-primary' : 'btn-outline-secondary',
              )}
              onClick={() => {
                setRecurrence(r)
                if (r === 'daily') setDaysOfWeek([...ALL_DAYS])
              }}
            >
              {t(`slots.recurrence${r.charAt(0).toUpperCase() + r.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* One-time: date picker */}
      {recurrence === 'once' && (
        <div className="mb-3">
          <label className="form-label fw-semibold">{t('slots.startDate')}</label>
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
      )}

      {/* Weekly: days of week */}
      {recurrence === 'weekly' && (
        <div className="mb-3">
          <label className="form-label fw-semibold">{t('slots.daysOfWeek')}</label>
          <div className="d-flex flex-wrap gap-2">
            {ALL_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={classNames('btn', 'btn-sm',
                  daysOfWeek.includes(d) ? 'btn-primary' : 'btn-outline-secondary',
                )}
                onClick={() => toggleDay(d)}
              >
                {t(`slots.days.${d}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date range for daily/weekly */}
      {recurrence !== 'once' && (
        <div className="row mb-3">
          <div className="col-6">
            <label className="form-label text-muted small">{t('slots.startDate')}</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-6">
            <label className="form-label text-muted small">{t('slots.endDate')}</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-text mt-1">{t('slots.dateRangeHint')}</div>
        </div>
      )}
    </>
  )

  // ── Header helpers ──
  const getTypeIcon = () => {
    if (slotType === 'default') return <FaStar className="text-warning me-2" />
    if (slotType === 'time') return <FaClock className="text-primary me-2" />
    if (slotType === 'event') return <FaBolt className="text-danger me-2" />
    return null
  }

  const getTypeLabel = () => {
    if (slotType === 'default') return t('slots.slotTypeDefault')
    if (slotType === 'time') return t('slots.slotTypeTime')
    if (slotType === 'event') return t('slots.slotTypeEvent')
    return ''
  }

  if (!isOpen && !isVisible) return null

  return (
    <>
      <div
        className={classNames('modal-backdrop', 'fade', { show: isOpen })}
        style={{
          opacity: isOpen ? 0.5 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
      />
      <div
        className={classNames('modal', 'fade', {
          show: isOpen,
          'd-block': isOpen || isVisible,
        })}
        tabIndex={-1}
        style={{
          display: isOpen || isVisible ? 'block' : 'none',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center">
                  {slotType && !isEditing && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() => setSlotType(null)}
                    >
                      &larr;
                    </button>
                  )}
                  {isEditing ? (
                    <>{getTypeIcon()}{t('slots.editSlot')}</>
                  ) : slotType ? (
                    <>{getTypeIcon()}{getTypeLabel()}</>
                  ) : (
                    t('slots.chooseSlotType')
                  )}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={onClose}
                />
              </div>

              <div className="modal-body">
                {!slotType && !isEditing ? (
                  renderTypeSelection()
                ) : slotType === 'default' ? (
                  renderDefaultForm()
                ) : slotType === 'event' ? (
                  renderEventForm()
                ) : (
                  renderTimeForm()
                )}
              </div>

              {slotType && (
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !canSubmit()}
                  >
                    {isSubmitting
                      ? t('slots.saving')
                      : isEditing
                        ? t('slots.save')
                        : t('slots.create')}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
