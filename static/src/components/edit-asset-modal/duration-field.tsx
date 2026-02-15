import { useTranslation } from 'react-i18next'
import { EditFormData } from '@/types'

interface DurationFieldProps {
  formData: EditFormData
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const DurationField = ({
  formData,
  handleInputChange,
}: DurationFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="row mb-3 duration">
      <label className="col-4 col-form-label">{t('editAsset.duration')}</label>
      <div className="col-7 controls">
        <input
          className="form-control shadow-none"
          name="duration"
          type="number"
          value={formData.duration}
          onChange={handleInputChange}
          disabled={formData.mimetype === 'video'}
        />
        {t('editAsset.seconds')} &nbsp;
      </div>
    </div>
  )
}
