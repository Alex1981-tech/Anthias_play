import { useTranslation } from 'react-i18next'
import { RootState } from '@/types'

export const DefaultDurations = ({
  settings,
  handleInputChange,
}: {
  settings: RootState['settings']['settings']
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
  const { t } = useTranslation()

  return (
    <div className="row">
      <div className="col-6 mb-3">
        <label className="small text-secondary">
          <small>{t('settings.defaultDuration')}</small>
        </label>
        <input
          className="form-control shadow-none"
          name="defaultDuration"
          type="number"
          value={settings.defaultDuration}
          onChange={handleInputChange}
        />
      </div>
      <div className="col-6 mb-3">
        <label className="small text-secondary">
          <small>{t('settings.defaultStreamingDuration')}</small>
        </label>
        <input
          className="form-control shadow-none"
          name="defaultStreamingDuration"
          type="number"
          value={settings.defaultStreamingDuration}
          onChange={handleInputChange}
        />
      </div>
    </div>
  )
}
