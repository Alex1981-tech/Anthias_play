import { useTranslation } from 'react-i18next'
import { EditFormData } from '@/types'

interface NameFieldProps {
  formData: EditFormData
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const NameField = ({ formData, handleInputChange }: NameFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="row mb-3 name">
      <label className="col-4 col-form-label">{t('editAsset.name')}</label>
      <div className="col-7">
        <input
          className="form-control shadow-none"
          name="name"
          placeholder={t('editAsset.namePlaceholder')}
          type="text"
          value={formData.name}
          onChange={handleInputChange}
        />
      </div>
    </div>
  )
}
