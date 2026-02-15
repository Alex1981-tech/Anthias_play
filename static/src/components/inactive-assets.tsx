import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectInactiveAssets } from '@/store/assets'
import { AssetRow } from '@/components/asset-row'
import { Asset, InactiveAssetsTableProps } from '@/types'

export const InactiveAssetsTable = ({
  onEditAsset,
}: InactiveAssetsTableProps) => {
  const { t } = useTranslation()
  const inactiveAssets = useSelector(selectInactiveAssets) as Asset[]

  return (
    <div className="table-responsive">
      <table className="InactiveAssets table table-borderless">
        <thead>
          <tr>
            <th className="text-secondary fw-bold asset_row_name">{t('assets.name')}</th>
            <th className="text-secondary fw-bold" style={{ width: '21%' }}>
              {t('assets.start')}
            </th>
            <th className="text-secondary fw-bold" style={{ width: '21%' }}>
              {t('assets.end')}
            </th>
            <th className="text-secondary fw-bold" style={{ width: '13%' }}>
              {t('assets.duration')}
            </th>
            <th className="text-secondary fw-bold" style={{ width: '7%' }}>
              {t('assets.activity')}
            </th>
            <th className="text-secondary fw-bold" style={{ width: '13%' }}>
              {t('assets.actions')}
            </th>
          </tr>
        </thead>
        <tbody id="inactive-assets">
          {inactiveAssets.map((asset) => (
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
              onEditAsset={onEditAsset}
              showDragHandle={false}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
