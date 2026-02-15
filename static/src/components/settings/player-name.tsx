import { useTranslation } from 'react-i18next'
import { RootState } from '@/types'

export const PlayerName = ({
  settings,
  handleInputChange,
}: {
  settings: RootState['settings']['settings']
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
  const { t } = useTranslation()

  return (
    <div className="mb-3">
      <label className="small text-secondary">
        <small>{t('settings.playerName')}</small>
      </label>
      <input
        className="form-control shadow-none"
        name="playerName"
        type="text"
        value={settings.playerName}
        onChange={handleInputChange}
      />
    </div>
  )
}
