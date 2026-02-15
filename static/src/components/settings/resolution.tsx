import { useTranslation } from 'react-i18next'
import { RootState } from '@/types'

const RESOLUTIONS = [
  '800x480',
  '1024x768',
  '1280x720',
  '1280x800',
  '1280x1024',
  '1360x768',
  '1366x768',
  '1440x900',
  '1600x900',
  '1680x1050',
  '1920x1080',
  '1920x1200',
  '2560x1080',
  '2560x1440',
  '3440x1440',
  '3840x2160',
]

export const Resolution = ({
  settings,
  handleInputChange,
}: {
  settings: RootState['settings']['settings']
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) => {
  const { t } = useTranslation()

  return (
    <div className="mb-3">
      <label className="small text-secondary">
        <small>{t('settings.resolution')}</small>
      </label>
      <select
        className="form-control shadow-none form-select"
        name="resolution"
        value={settings.resolution}
        onChange={handleInputChange}
      >
        {RESOLUTIONS.map((res) => (
          <option key={res} value={res}>
            {res}
          </option>
        ))}
      </select>
    </div>
  )
}
