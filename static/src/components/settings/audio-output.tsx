import { useTranslation } from 'react-i18next'
import { RootState } from '@/types'

export const AudioOutput = ({
  settings,
  handleInputChange,
  deviceModel,
}: {
  settings: RootState['settings']['settings']
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  deviceModel: string
}) => {
  const { t } = useTranslation()

  return (
    <div className="mb-3">
      <label className="small text-secondary">
        <small>{t('settings.audioOutput')}</small>
      </label>
      <select
        className="form-control shadow-none form-select"
        name="audioOutput"
        value={settings.audioOutput}
        onChange={handleInputChange}
      >
        <option value="hdmi">{t('settings.hdmi')}</option>
        {!deviceModel.includes('Raspberry Pi 5') && (
          <option value="local">{t('settings.jack35mm')}</option>
        )}
      </select>
    </div>
  )
}
