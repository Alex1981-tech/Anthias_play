import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { updateSetting } from '@/store/settings'
import type { AppDispatch } from '@/types'

export const LanguagePicker = () => {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    i18n.changeLanguage(value)
    dispatch(updateSetting({ name: 'language', value }))
  }

  return (
    <div className="mt-4">
      <label className="small text-secondary">
        <small>{t('settings.language')}</small>
      </label>
      <select
        className="form-control shadow-none form-select"
        value={i18n.language}
        onChange={handleChange}
      >
        <option value="en">{t('languages.en')}</option>
        <option value="uk">{t('languages.uk')}</option>
        <option value="fr">{t('languages.fr')}</option>
        <option value="de">{t('languages.de')}</option>
        <option value="pl">{t('languages.pl')}</option>
      </select>
    </div>
  )
}
