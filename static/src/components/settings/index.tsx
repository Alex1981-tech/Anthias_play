import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Swal from 'sweetalert2'
import { RootState, AppDispatch } from '@/types'

import { SWEETALERT_TIMER } from '@/constants'
import {
  fetchSettings,
  fetchDeviceModel,
  updateSettings,
  updateSetting,
} from '@/store/settings'
import { SystemControls } from '@/components/settings/system-controls'
import { Backup } from '@/components/settings/backup'
import { Authentication } from '@/components/settings/authentication'
import { PlayerName } from '@/components/settings/player-name'
import { DefaultDurations } from '@/components/settings/default-durations'
import { AudioOutput } from '@/components/settings/audio-output'
import { DateFormat } from '@/components/settings/date-format'
import { ToggleableSetting } from '@/components/settings/toggleable-setting'
import { Update } from '@/components/settings/update'
import { Resolution } from '@/components/settings/resolution'
import { LanguagePicker } from '@/components/settings/language-picker'
import { DisplayPowerScheduleSection } from '@/components/settings/display-power-schedule'

export const Settings = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const { settings, deviceModel, isLoading } = useSelector(
    (state: RootState) => state.settings,
  )
  const [upToDate, setUpToDate] = useState<boolean>(true)
  const [isBalena, setIsBalena] = useState<boolean>(false)

  useEffect(() => {
    dispatch(fetchSettings())
    dispatch(fetchDeviceModel())
  }, [dispatch])

  useEffect(() => {
    fetch('/api/v2/info')
      .then((res) => res.json())
      .then((data) => {
        setUpToDate(data.up_to_date)
      })

    fetch('/api/v2/integrations')
      .then((res) => res.json())
      .then((data) => {
        setIsBalena(data.is_balena)
      })
  }, [])

  useEffect(() => {
    const title = settings.playerName
      ? `${settings.playerName} · ${t('settings.title')}`
      : t('settings.title')
    document.title = title
  }, [settings.playerName, t])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target
    const checked =
      e.target instanceof HTMLInputElement ? e.target.checked : false
    dispatch(
      updateSetting({
        name: name as keyof RootState['settings']['settings'],
        value: type === 'checkbox' ? checked : value,
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await dispatch(updateSettings(settings)).unwrap()

      await Swal.fire({
        title: t('common.success'),
        text: t('settings.saveSuccess'),
        icon: 'success',
        timer: SWEETALERT_TIMER,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          htmlContainer: 'swal2-html-container',
        },
      })

      dispatch(fetchSettings())
    } catch (err) {
      await Swal.fire({
        title: t('common.error'),
        text: (err as Error).message || t('settings.saveError'),
        icon: 'error',
        customClass: {
          popup: 'swal2-popup',
          title: 'swal2-title',
          htmlContainer: 'swal2-html-container',
          confirmButton: 'swal2-confirm',
        },
      })
    }
  }

  return (
    <div className="container">
      <div className="row py-2">
        <div className="col-12">
          <h4 className="page-header text-white">
            <b>{t('settings.title')}</b>
          </h4>
        </div>
      </div>

      <div className="row content px-3">
        <div className="col-12 my-3">
          <form onSubmit={handleSubmit} className="row">
            <div className="col-6 d-flex flex-column justify-content-between">
              <PlayerName
                settings={settings}
                handleInputChange={handleInputChange}
              />

              <DefaultDurations
                settings={settings}
                handleInputChange={handleInputChange}
              />

              <AudioOutput
                settings={settings}
                handleInputChange={handleInputChange}
                deviceModel={deviceModel}
              />

              <Resolution
                settings={settings}
                handleInputChange={handleInputChange}
              />

              <DateFormat
                settings={settings}
                handleInputChange={handleInputChange}
              />

              <Authentication />
            </div>

            <div className="col-6 d-flex flex-column justify-content-start">
              <ToggleableSetting
                settings={settings}
                handleInputChange={handleInputChange}
                label={t('settings.showSplash')}
                name="showSplash"
              />

              <ToggleableSetting
                settings={settings}
                handleInputChange={handleInputChange}
                label={t('settings.defaultAssets')}
                name="defaultAssets"
              />

              <ToggleableSetting
                settings={settings}
                handleInputChange={handleInputChange}
                label={t('settings.shufflePlaylist')}
                name="shufflePlaylist"
              />

              <ToggleableSetting
                settings={settings}
                handleInputChange={handleInputChange}
                label={t('settings.use24HourClock')}
                name="use24HourClock"
              />

              <ToggleableSetting
                settings={settings}
                handleInputChange={handleInputChange}
                label={t('settings.debugLogging')}
                name="debugLogging"
              />

              <LanguagePicker />

              <DisplayPowerScheduleSection settings={settings} />
            </div>

            <div className="col-12">
              <div className="text-end">
                <button
                  className="btn btn-long btn-primary"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  ) : (
                    t('settings.saveSettings')
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {!upToDate && !isBalena && <Update />}

      <Backup />
      <SystemControls />
    </div>
  )
}
