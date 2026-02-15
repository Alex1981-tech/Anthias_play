import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const Integrations = () => {
  const { t } = useTranslation()
  const [data, setData] = useState({
    is_balena: false,
    balena_device_id: '',
    balena_app_id: '',
    balena_app_name: '',
    balena_supervisor_version: '',
    balena_host_os_version: '',
    balena_device_name_at_init: '',
  })
  const [playerName, setPlayerName] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [integrationsResponse, settingsResponse] = await Promise.all([
          fetch('/api/v2/integrations'),
          fetch('/api/v2/device_settings'),
        ])

        const [integrationsData, settingsData] = await Promise.all([
          integrationsResponse.json(),
          settingsResponse.json(),
        ])

        setData(integrationsData)
        setPlayerName(settingsData.player_name ?? '')
      } catch {}
    }

    fetchData()
  }, [])

  useEffect(() => {
    const title = playerName ? `${playerName} · ${t('integrations.title')}` : t('integrations.title')
    document.title = title
  }, [playerName, t])

  return (
    <div className="container">
      <div className="row py-2">
        <div className="col-12">
          <h4 className="page-header text-white">
            <b>{t('integrations.title')}</b>
          </h4>
        </div>
      </div>
      <div className="row content" style={{ minHeight: '60vh' }}>
        {data.is_balena && (
          <div id="balena-section" className="col-12">
            <h4 className="page-header">
              <b>{t('integrations.balena')}</b>
            </h4>
            <table className="table">
              <thead className="table-borderless">
                <tr>
                  <th className="text-secondary font-weight-normal" scope="col">
                    {t('integrations.option')}
                  </th>
                  <th className="text-secondary font-weight-normal" scope="col">
                    {t('integrations.value')}
                  </th>
                  <th className="text-secondary font-weight-normal" scope="col">
                    {t('integrations.description')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.balena_device_name_at_init && (
                  <tr>
                    <th scope="row">{t('integrations.deviceName')}</th>
                    <td>{data.balena_device_name_at_init}</td>
                    <td>{t('integrations.deviceNameDesc')}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">{t('integrations.deviceUuid')}</th>
                  <td>{data.balena_device_id}</td>
                  <td>{t('integrations.deviceUuidDesc')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('integrations.appId')}</th>
                  <td>{data.balena_app_id}</td>
                  <td>{t('integrations.appIdDesc')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('integrations.appName')}</th>
                  <td>{data.balena_app_name}</td>
                  <td>{t('integrations.appNameDesc')}</td>
                </tr>
                {data.balena_supervisor_version && (
                  <tr>
                    <th scope="row">{t('integrations.supervisorVersion')}</th>
                    <td>{data.balena_supervisor_version}</td>
                    <td>{t('integrations.supervisorVersionDesc')}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">{t('integrations.hostOsVersion')}</th>
                  <td>{data.balena_host_os_version}</td>
                  <td>{t('integrations.hostOsVersionDesc')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
