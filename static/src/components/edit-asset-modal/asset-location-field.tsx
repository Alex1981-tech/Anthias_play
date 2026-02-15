import { useTranslation } from 'react-i18next'
import { AssetEditData } from '@/types'

interface AssetLocationFieldProps {
  asset: AssetEditData | null
}

export const AssetLocationField = ({ asset }: AssetLocationFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="row mb-3">
      <label className="col-4 col-form-label">{t('editAsset.assetLocation')}</label>
      <div className="col-8 controls">
        <div
          className="uri-text first text-break h-100"
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span>{asset?.uri ?? ''}</span>
        </div>
      </div>
    </div>
  )
}
