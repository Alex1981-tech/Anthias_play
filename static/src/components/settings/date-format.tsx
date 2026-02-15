import { useTranslation } from 'react-i18next'
import { RootState } from '@/types'

export const DateFormat = ({
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
        <small>{t('settings.dateFormat')}</small>
      </label>
      <select
        className="form-control shadow-none form-select"
        name="dateFormat"
        value={settings.dateFormat}
        onChange={handleInputChange}
      >
        <option value="mm/dd/yyyy">{t('common.dateFormats.monthDayYear')}</option>
        <option value="dd/mm/yyyy">{t('common.dateFormats.dayMonthYear')}</option>
        <option value="yyyy/mm/dd">{t('common.dateFormats.yearMonthDay')}</option>
        <option value="mm-dd-yyyy">{t('common.dateFormats.monthDashDayDashYear')}</option>
        <option value="dd-mm-yyyy">{t('common.dateFormats.dayDashMonthDashYear')}</option>
        <option value="yyyy-mm-dd">{t('common.dateFormats.yearDashMonthDashDay')}</option>
        <option value="mm.dd.yyyy">{t('common.dateFormats.monthDotDayDotYear')}</option>
        <option value="dd.mm.yyyy">{t('common.dateFormats.dayDotMonthDotYear')}</option>
        <option value="yyyy.mm.dd">{t('common.dateFormats.yearDotMonthDotDay')}</option>
      </select>
    </div>
  )
}
