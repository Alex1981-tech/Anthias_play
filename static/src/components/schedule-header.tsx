import { useTranslation } from 'react-i18next'
import { PlayerNameBadge } from '@/components/player-name-badge'
import { ScheduleActionButtons } from '@/components/schedule-action-buttons'

interface ScheduleHeaderProps {
  playerName: string
  onPreviousAsset: (event: React.MouseEvent) => void
  onNextAsset: (event: React.MouseEvent) => void
  onAddAsset: (event: React.MouseEvent) => void
  onAddSlot?: () => void
}

export const ScheduleHeader = ({
  playerName,
  onPreviousAsset,
  onNextAsset,
  onAddAsset,
  onAddSlot,
}: ScheduleHeaderProps) => {
  const { t } = useTranslation()

  return (
    <div className="container pt-3 pb-3">
      <div className="row">
        <div className="col-12">
          <h4 className="mb-3">
            <b className="text-white">{t('schedule.title')}</b>
          </h4>

          <PlayerNameBadge playerName={playerName} />

          <ScheduleActionButtons
            onPreviousAsset={onPreviousAsset}
            onNextAsset={onNextAsset}
            onAddAsset={onAddAsset}
            onAddSlot={onAddSlot}
          />
        </div>
      </div>
    </div>
  )
}
