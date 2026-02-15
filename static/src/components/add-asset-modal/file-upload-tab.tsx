import React from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

interface FileUploadTabProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  dropZoneRef: React.RefObject<HTMLDivElement | null>
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleFileDrop: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  isSubmitting: boolean
  uploadProgress: number
}

export const FileUploadTab = ({
  fileInputRef,
  dropZoneRef,
  handleFileSelect,
  handleFileDrop,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  isSubmitting,
  uploadProgress,
}: FileUploadTabProps) => {
  const { t } = useTranslation()

  return (
    <div
      id="tab-file_upload"
      className={classNames('tab-pane', {
        active: true,
      })}
    >
      <div className="control-group">
        <div
          className="filedrop"
          ref={dropZoneRef}
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <div className="upload-header">
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              {t('addAsset.addFiles')}
            </button>
            <input
              ref={fileInputRef}
              name="file_upload"
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={isSubmitting}
            />
            <br />
            {t('addAsset.or')}
          </div>
          <div>{t('addAsset.dropFiles')}</div>
        </div>
      </div>
      <div
        className="progress"
        style={{
          marginTop: '1.25rem',
          opacity: isSubmitting ? 1 : 0,
          maxHeight: isSubmitting ? '20px' : '0',
          overflow: 'hidden',
          transition: 'opacity 0.3s ease-in-out, max-height 0.3s ease-in-out',
        }}
      >
        <div
          className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
          style={{
            width: `${uploadProgress}%`,
            transition: 'width 0.3s ease-in-out',
          }}
        ></div>
      </div>
    </div>
  )
}
