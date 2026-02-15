import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

interface EmptyAssetMessageProps {
  onAddAssetClick: (e: React.MouseEvent<HTMLAnchorElement>) => void
  isActive?: boolean
}

export const EmptyAssetMessage = ({
  onAddAssetClick,
  isActive,
}: EmptyAssetMessageProps) => {
  const { t } = useTranslation()

  return (
    <div className="EmptyAssetMessage table-assets-help-text">
      {t('schedule.noAssets')}{' '}
      <a
        className={classNames('add-asset-button', {
          'text-primary': isActive,
          'text-info': !isActive,
        })}
        href="#"
        onClick={onAddAssetClick}
      >
        {t('schedule.addAssetLink')}
      </a>{' '}
      {t('schedule.now')}
    </div>
  )
}
