import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import classNames from 'classnames'
import Swal from 'sweetalert2'

import { AppDispatch, ScheduleSlot } from '@/types'
import { addSlotItem } from '@/store/schedule'
import { SWEETALERT_TIMER } from '@/constants'

interface AddItemModalProps {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
  slot: ScheduleSlot
}

interface AvailableAsset {
  asset_id: string
  name: string
  mimetype: string
  duration: number
  is_enabled: number
  uri: string
}

export const AddItemModal = ({
  isOpen,
  onClose,
  onAdded,
  slot,
}: AddItemModalProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()

  const [assets, setAssets] = useState<AvailableAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [durationOverride, setDurationOverride] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setSelectedAssetId('')
      setDurationOverride('')
      fetchAvailableAssets()
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const fetchAvailableAssets = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v2/assets')
      const data: AvailableAsset[] = await response.json()
      // Filter out assets already in this slot
      const existingIds = new Set(slot.items.map((i) => i.asset_id))
      setAssets(data.filter((a) => !existingIds.has(a.asset_id)))
    } catch {
      setAssets([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssetId) return

    setIsSubmitting(true)
    try {
      const durOverride = durationOverride.trim()
        ? parseInt(durationOverride, 10)
        : null

      await dispatch(
        addSlotItem({
          slot_id: slot.slot_id,
          asset_id: selectedAssetId,
          duration_override:
            durOverride !== null && !isNaN(durOverride) ? durOverride : null,
        }),
      ).unwrap()

      await Swal.fire({
        title: t('common.success'),
        icon: 'success',
        timer: SWEETALERT_TIMER,
        showConfirmButton: false,
      })
      onAdded()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('slots.addItemFailed')
      Swal.fire(t('common.error'), message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getMimetypeLabel = (mimetype: string) => {
    if (!mimetype) return '—'
    const main = mimetype.split('/')[0]
    if (main === 'image') return t('editAsset.image')
    if (main === 'video') return t('editAsset.video')
    if (mimetype.includes('html') || mimetype === 'webpage')
      return t('editAsset.webpage')
    if (mimetype.includes('stream')) return t('editAsset.streaming')
    return main
  }

  if (!isOpen && !isVisible) return null

  return (
    <>
      <div
        className={classNames('modal-backdrop', 'fade', {
          show: isOpen,
        })}
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
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">
                  {t('slots.addItemToSlot', { name: slot.name })}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={onClose}
                />
              </div>

              <div className="modal-body">
                {loading ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm" role="status" />
                  </div>
                ) : assets.length === 0 ? (
                  <p className="text-muted">{t('slots.noAvailableAssets')}</p>
                ) : (
                  <>
                    {/* Asset selection */}
                    <div className="mb-3">
                      <label className="form-label">
                        {t('slots.selectAsset')}
                      </label>
                      <div
                        className="list-group"
                        style={{ maxHeight: '300px', overflowY: 'auto' }}
                      >
                        {assets.map((asset) => (
                          <button
                            key={asset.asset_id}
                            type="button"
                            className={classNames(
                              'list-group-item',
                              'list-group-item-action',
                              'd-flex',
                              'justify-content-between',
                              'align-items-center',
                              {
                                active: selectedAssetId === asset.asset_id,
                              },
                            )}
                            onClick={() => setSelectedAssetId(asset.asset_id)}
                          >
                            <div>
                              <strong>{asset.name}</strong>
                              <br />
                              <small
                                className={
                                  selectedAssetId === asset.asset_id
                                    ? 'text-light'
                                    : 'text-muted'
                                }
                              >
                                {getMimetypeLabel(asset.mimetype)} &middot;{' '}
                                {asset.duration}s
                              </small>
                            </div>
                            {!asset.is_enabled && (
                              <span className="badge bg-secondary">
                                {t('slots.disabled')}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration override */}
                    <div className="mb-3">
                      <label className="form-label">
                        {t('slots.durationOverride')}
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={durationOverride}
                        onChange={(e) => setDurationOverride(e.target.value)}
                        placeholder={t('slots.durationOverridePlaceholder')}
                        min="1"
                      />
                      <div className="form-text">
                        {t('slots.durationOverrideHint')}
                      </div>
                    </div>
                  </>
                )}
              </div>

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
                  disabled={isSubmitting || !selectedAssetId}
                >
                  {isSubmitting ? t('slots.adding') : t('slots.addItem')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
