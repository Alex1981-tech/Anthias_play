import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { AppDispatch, RootState, DisplayPowerSchedule } from '@/types'
import { updateSetting } from '@/store/settings'

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7']

export const DisplayPowerScheduleSection = ({
  settings,
}: {
  settings: RootState['settings']['settings']
}) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const schedule = settings.displayPowerSchedule

  const update = (newSchedule: DisplayPowerSchedule) => {
    dispatch(
      updateSetting({
        name: 'displayPowerSchedule',
        value: newSchedule,
      }),
    )
  }

  const applyToGroup = (dayKeys: string[]) => {
    const newDays = { ...schedule.days }
    dayKeys.forEach((dk) => {
      newDays[dk] = { on: '08:00', off: '22:00' }
    })
    update({ ...schedule, days: newDays })
  }

  return (
    <div className="mt-4">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <label className="fw-bold">{t('settings.displaySchedule')}</label>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
            {t('settings.displayScheduleDesc')}
          </div>
        </div>
        <div className="form-check form-switch form-switch-info ms-3">
          <input
            className="form-check-input shadow-none"
            type="checkbox"
            role="switch"
            id="displayScheduleEnabled"
            checked={schedule.enabled}
            onChange={(e) => update({ ...schedule, enabled: e.target.checked })}
          />
          <label
            className="form-check-label"
            htmlFor="displayScheduleEnabled"
            style={{ fontSize: '0.85rem' }}
          >
            {t('settings.scheduleEnabled')}
          </label>
        </div>
      </div>

      {schedule.enabled && (
        <>
          <div className="d-flex gap-2 mb-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => applyToGroup(DAY_KEYS)}
            >
              {t('settings.applyToAll')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => applyToGroup(['1', '2', '3', '4', '5'])}
            >
              {t('settings.applyWeekdays')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => applyToGroup(['6', '7'])}
            >
              {t('settings.applyWeekend')}
            </button>
          </div>

          {DAY_KEYS.map((dk) => {
            const dayCfg = schedule.days[dk]
            const dayEnabled = dayCfg !== null
            const dayLabel = t(`slots.days.${dk}`)
            return (
              <div
                key={dk}
                className="d-flex align-items-center gap-2 mb-1"
                style={{ fontSize: '0.9rem' }}
              >
                <div className="form-check form-switch form-switch-info mb-0">
                  <input
                    className="form-check-input shadow-none"
                    type="checkbox"
                    checked={dayEnabled}
                    onChange={(e) => {
                      const newDays = { ...schedule.days }
                      newDays[dk] = e.target.checked
                        ? { on: '08:00', off: '22:00' }
                        : null
                      update({ ...schedule, days: newDays })
                    }}
                  />
                </div>
                <span
                  className="fw-bold"
                  style={{ width: '32px' }}
                >
                  {dayLabel}
                </span>
                {dayEnabled ? (
                  <>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      style={{ width: '120px' }}
                      value={dayCfg!.on}
                      onChange={(e) => {
                        const newDays = { ...schedule.days }
                        newDays[dk] = { ...dayCfg!, on: e.target.value }
                        update({ ...schedule, days: newDays })
                      }}
                    />
                    <span className="text-muted">&mdash;</span>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      style={{ width: '120px' }}
                      value={dayCfg!.off}
                      onChange={(e) => {
                        const newDays = { ...schedule.days }
                        newDays[dk] = { ...dayCfg!, off: e.target.value }
                        update({ ...schedule, days: newDays })
                      }}
                    />
                  </>
                ) : (
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {t('settings.screenOffAllDay')}
                  </span>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
