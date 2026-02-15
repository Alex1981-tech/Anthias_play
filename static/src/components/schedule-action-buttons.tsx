import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { FaFastBackward, FaFastForward, FaPlus } from 'react-icons/fa'

interface ScheduleActionButtonsProps {
  onPreviousAsset: (event: React.MouseEvent) => void
  onNextAsset: (event: React.MouseEvent) => void
  onAddAsset: (event: React.MouseEvent) => void
  onAddSlot?: () => void
}

export const ScheduleActionButtons = ({
  onPreviousAsset,
  onNextAsset,
  onAddAsset,
  onAddSlot,
}: ScheduleActionButtonsProps) => {
  const { t } = useTranslation()

  return (
    <div className="d-flex flex-column flex-sm-row gap-2 mb-3 mt-4">
      <button
        id="previous-asset-button"
        className={classNames(
          'btn',
          'btn-long',
          'btn-light',
          'fw-bold',
          'text-dark',
        )}
        onClick={onPreviousAsset}
      >
        <span className="d-flex align-items-center justify-content-center">
          <FaFastBackward className="pe-2 fs-4" />
          {t('schedule.previousAsset')}
        </span>
      </button>
      <button
        id="next-asset-button"
        className={classNames(
          'btn',
          'btn-long',
          'btn-light',
          'fw-bold',
          'text-dark',
        )}
        onClick={onNextAsset}
      >
        <span className="d-flex align-items-center justify-content-center">
          <FaFastForward className="pe-2 fs-4" />
          {t('schedule.nextAsset')}
        </span>
      </button>
      <button
        id="add-asset-button"
        className={classNames(
          'add-asset-button',
          'btn',
          'btn-long',
          'btn-primary',
        )}
        onClick={onAddAsset}
      >
        <span className="d-flex align-items-center justify-content-center">
          <FaPlus className="pe-2 fs-5" />
          {t('schedule.addAsset')}
        </span>
      </button>
      {onAddSlot && (
        <button
          className={classNames(
            'btn',
            'btn-long',
            'btn-outline-primary',
          )}
          onClick={onAddSlot}
        >
          <span className="d-flex align-items-center justify-content-center">
            <FaPlus className="pe-2 fs-5" />
            {t('slots.addSlot')}
          </span>
        </button>
      )}
    </div>
  )
}
