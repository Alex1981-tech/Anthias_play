import { useSelector, useDispatch } from 'react-redux'
import {
  selectActiveAssets,
  updateAssetOrder,
  fetchAssets,
} from '@/store/assets'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableAssetRow } from '@/components/sortable-asset-row'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Asset, ActiveAssetsTableProps, AppDispatch } from '@/types'

export const ActiveAssetsTable = ({ onEditAsset }: ActiveAssetsTableProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const activeAssets = useSelector(selectActiveAssets) as Asset[]
  const [items, setItems] = useState<Asset[]>(activeAssets)

  useEffect(() => {
    setItems(activeAssets)
  }, [activeAssets])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = items.findIndex(
      (asset) => asset.asset_id.toString() === active.id,
    )
    const newIndex = items.findIndex(
      (asset) => asset.asset_id.toString() === over.id,
    )

    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)

    const activeIds = newItems.map((asset: Asset) => asset.asset_id)

    try {
      await dispatch(updateAssetOrder(activeIds.join(','))).unwrap()
      dispatch(fetchAssets())
    } catch {
      setItems(activeAssets)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="table-responsive">
        <table className="ActiveAssets table table-borderless">
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
              <th className="fw-bold" style={{ width: '7%' }}>
                {t('assets.activity')}
              </th>
              <th className="fw-bold" style={{ width: '13%' }}>
                {t('assets.actions')}
              </th>
            </tr>
          </thead>
          <tbody id="active-assets">
            <SortableContext
              items={items.map((a) => a.asset_id.toString())}
              strategy={verticalListSortingStrategy}
            >
              {items.map((asset) => (
                <SortableAssetRow
                  key={asset.asset_id}
                  id={asset.asset_id.toString()}
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
                  onEditAsset={onEditAsset}
                  showDragHandle={true}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </DndContext>
  )
}
