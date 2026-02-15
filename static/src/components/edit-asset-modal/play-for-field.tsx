import { useTranslation } from 'react-i18next'
import { handleLoopTimesChange } from '@/components/edit-asset-modal/utils'
import { EditFormData } from '@/types'

interface PlayForFieldProps {
  loopTimes: string
  startDateDate: string
  startDateTime: string
  setLoopTimes: (value: string) => void
  setEndDateDate: (value: string) => void
  setEndDateTime: (value: string) => void
  setFormData: (updater: (prev: EditFormData) => EditFormData) => void
}

export const PlayForField = ({
  loopTimes,
  startDateDate,
  startDateTime,
  setLoopTimes,
  setEndDateDate,
  setEndDateTime,
  setFormData,
}: PlayForFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="row mb-3 loop_date">
      <label className="col-4 col-form-label">{t('editAsset.playFor')}</label>
      <div className="controls col-7">
        <select
          className="form-control shadow-none form-select"
          id="loop_times"
          value={loopTimes}
          onChange={(e) =>
            handleLoopTimesChange({
              e,
              startDateDate,
              startDateTime,
              setLoopTimes,
              setEndDateDate,
              setEndDateTime,
              setFormData,
            })
          }
        >
          <option value="day">{t('editAsset.1day')}</option>
          <option value="week">{t('editAsset.1week')}</option>
          <option value="month">{t('editAsset.1month')}</option>
          <option value="year">{t('editAsset.1year')}</option>
          <option value="forever">{t('editAsset.forever')}</option>
          <option value="manual">{t('editAsset.manual')}</option>
        </select>
      </div>
    </div>
  )
}
