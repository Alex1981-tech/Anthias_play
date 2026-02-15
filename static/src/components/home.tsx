import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { FaClock, FaStar } from 'react-icons/fa'
import Swal from 'sweetalert2'

import {
  fetchAssets,
  selectAllAssets,
  selectActiveAssets,
  selectInactiveAssets,
} from '@/store/assets'
import {
  fetchScheduleSlots,
  fetchScheduleStatus,
  deleteScheduleSlot,
  selectScheduleSlots,
  selectScheduleStatus,
  selectDefaultSlot,
  selectNonDefaultSlots,
} from '@/store/schedule'
import { AssetEditData, AppDispatch, Asset } from '@/types'

import { ActiveAssetsSection } from '@/components/active-assets-section'
import { AddAssetModal } from '@/components/add-asset-modal'
import { EditAssetModal } from '@/components/edit-asset-modal'
import { InactiveAssetsSection } from '@/components/inactive-assets-section'
import { ScheduleHeader } from '@/components/schedule-header'
import { SlotCard } from '@/components/schedule/slot-card'
import { SlotFormModal } from '@/components/schedule/slot-form-modal'
import { AssetRow } from '@/components/asset-row'
import { useTooltipInitialization } from '@/hooks/use-tooltip-initialization'

export const ScheduleOverview = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const allAssets = useSelector(selectAllAssets)
  const activeAssets = useSelector(selectActiveAssets)
  const inactiveAssets = useSelector(selectInactiveAssets)

  const slots = useSelector(selectScheduleSlots)
  const status = useSelector(selectScheduleStatus)
  const defaultSlot = useSelector(selectDefaultSlot)
  const nonDefaultSlots = useSelector(selectNonDefaultSlots)
  const hasSlots = slots.length > 0

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [assetToEdit, setAssetToEdit] = useState<AssetEditData | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [isCreateSlotModalOpen, setIsCreateSlotModalOpen] = useState(false)

  const fetchPlayerName = async () => {
    try {
      const response = await fetch('/api/v2/device_settings')
      const data = await response.json()
      setPlayerName(data.player_name || '')
    } catch {}
  }

  useEffect(() => {
    const title = playerName
      ? `${playerName} · ${t('schedule.title')}`
      : t('schedule.title')
    document.title = title
    dispatch(fetchAssets())
    dispatch(fetchScheduleSlots())
    dispatch(fetchScheduleStatus())
    fetchPlayerName()
  }, [dispatch, playerName, t])

  useTooltipInitialization(activeAssets.length, inactiveAssets.length)

  const handleAddAsset = (event: React.MouseEvent) => {
    event.preventDefault()
    setIsModalOpen(true)
    setAssetToEdit(null)
  }

  const handlePreviousAsset = async (event: React.MouseEvent) => {
    event.preventDefault()
    await fetch('/api/v2/assets/control/previous')
  }

  const handleNextAsset = async (event: React.MouseEvent) => {
    event.preventDefault()
    await fetch('/api/v2/assets/control/next')
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleSaveAsset = () => {
    setIsModalOpen(false)
  }

  const handleEditAsset = (asset: AssetEditData) => {
    setAssetToEdit(asset)
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setAssetToEdit(null)
  }

  // Schedule slot handlers
  const refreshSchedule = () => {
    dispatch(fetchScheduleSlots())
    dispatch(fetchScheduleStatus())
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
        refreshSchedule()
      } catch {
        Swal.fire(t('common.error'), t('slots.deleteFailed'), 'error')
      }
    }
  }

  const formatTime = (timeStr: string) => {
    return timeStr ? timeStr.substring(0, 5) : ''
  }

  return (
    <>
      <ScheduleHeader
        playerName={playerName}
        onPreviousAsset={handlePreviousAsset}
        onNextAsset={handleNextAsset}
        onAddAsset={handleAddAsset}
        onAddSlot={hasSlots ? () => setIsCreateSlotModalOpen(true) : undefined}
      />

      {hasSlots ? (
        <>
          {/* Schedule slots section — same style as active assets */}
          <div className="container">
            <div className="row content active-content px-2 pt-4">
              <div className="col-12 mb-5">
                <section>
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
                        onUpdated={refreshSchedule}
                      />
                    </>
                  )}

                  {/* Time-based slots */}
                  {nonDefaultSlots.length > 0 && (
                    <>
                      <h5 className="mb-2">
                        <FaClock className="me-2" />
                        {t('slots.timeSlots')}
                      </h5>
                      {nonDefaultSlots.map((slot) => (
                        <SlotCard
                          key={slot.slot_id}
                          slot={slot}
                          onDelete={handleDeleteSlot}
                          onUpdated={refreshSchedule}
                        />
                      ))}
                    </>
                  )}

                </section>
              </div>
            </div>
          </div>

          {/* Content section — all assets, single table */}
          <div className="container mt-4">
            <div className="row content active-content px-2 pt-4">
              <div className="col-12 mb-5">
                <section>
                  <h5>
                    <b>{t('schedule.content')}</b>
                  </h5>
                  <div className="table-responsive">
                    <table className="table table-borderless">
                      <thead>
                        <tr>
                          <th className="fw-bold asset_row_name">{t('assets.name')}</th>
                          <th className="fw-bold" style={{ width: '21%' }}>
                            {t('assets.start')}
                          </th>
                          <th className="fw-bold" style={{ width: '21%' }}>
                            {t('assets.end')}
                          </th>
                          <th className="fw-bold" style={{ width: '13%' }}>
                            {t('assets.duration')}
                          </th>
                          <th className="fw-bold" style={{ width: '13%' }}>
                            {t('assets.actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAssets.map((asset: Asset) => (
                          <AssetRow
                            key={asset.asset_id}
                            name={asset.name}
                            startDate={asset.start_date}
                            endDate={asset.end_date}
                            duration={asset.duration}
                            isEnabled={Boolean(asset.is_enabled)}
                            assetId={asset.asset_id}
                            isProcessing={asset.is_processing ? 1 : 0}
                            uri={asset.uri}
                            mimetype={asset.mimetype}
                            nocache={asset.nocache}
                            skipAssetCheck={asset.skip_asset_check}
                            onEditAsset={handleEditAsset}
                            showDragHandle={false}
                            hideActivityToggle={true}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {allAssets.length === 0 && (
                    <p style={{ opacity: 0.6 }}>
                      {t('schedule.noAssets')}{' '}
                      <a href="#" onClick={handleAddAsset}>
                        {t('schedule.addAssetLink')}
                      </a>
                    </p>
                  )}
                </section>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* No slots — show legacy Active/Inactive layout */
        <span id="assets">
          <ActiveAssetsSection
            activeAssetsCount={activeAssets.length}
            onEditAsset={handleEditAsset}
            onAddAssetClick={handleAddAsset}
          />

          <InactiveAssetsSection
            inactiveAssetsCount={inactiveAssets.length}
            onEditAsset={handleEditAsset}
            onAddAssetClick={handleAddAsset}
          />
        </span>
      )}

      <AddAssetModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveAsset}
        initialData={assetToEdit || undefined}
      />

      <EditAssetModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        asset={assetToEdit}
      />

      <SlotFormModal
        isOpen={isCreateSlotModalOpen}
        onClose={() => setIsCreateSlotModalOpen(false)}
        onSaved={() => {
          setIsCreateSlotModalOpen(false)
          refreshSchedule()
        }}
      />
    </>
  )
}
