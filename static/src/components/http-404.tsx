import React from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

const Http404: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div
      className={classNames(
        'container',
        'd-flex',
        'align-items-center',
        'justify-content-center',
        'pt-5',
        'mb-5',
        'bg-dark',
        'text-primary',
      )}
    >
      <div className="col-12 d-table-cell align-middle">
        <div className="p-5">
          <div className="row">
            <div className="col-12 text-center">
              <div className="mb-2">
                <h1 className="display-1">404</h1>
              </div>
              <h3 className="mb-5">
                <b>{t('http404.title')}</b>
              </h3>
              <p className="mb-4 text-white">
                {t('http404.message')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Http404
