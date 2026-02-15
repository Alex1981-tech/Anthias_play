import { useTranslation } from 'react-i18next'
import { EditFormData } from '@/types'

interface AssetTypeFieldProps {
  formData: EditFormData
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

export const AssetTypeField = ({
  formData,
  handleInputChange,
}: AssetTypeFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="row mb-3 mimetype">
      <label className="col-4 col-form-label">{t('editAsset.assetType')}</label>
      <div className="col-4 controls">
        <select
          className="mime-select form-control shadow-none form-select"
          name="mimetype"
          value={formData.mimetype}
          onChange={handleInputChange}
          disabled={true}
        >
          <option value="webpage">{t('editAsset.webpage')}</option>
          <option value="image">{t('editAsset.image')}</option>
          <option value="video">{t('editAsset.video')}</option>
          <option value="streaming">{t('editAsset.streaming')}</option>
          <option value="youtube_asset">YouTubeAsset</option>
        </select>
      </div>
    </div>
  )
}
