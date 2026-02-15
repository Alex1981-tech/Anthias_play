import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Swal from 'sweetalert2'
import { OperationConfig, AppDispatch } from '@/types'

import { SWEETALERT_TIMER } from '@/constants'
import { systemOperation } from '@/store/settings'

type SystemOperationType = 'reboot' | 'shutdown'

export const SystemControls = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()

  const handleSystemOperation = async (operation: SystemOperationType) => {
    const config: Record<SystemOperationType, OperationConfig> = {
      reboot: {
        title: t('common.areYouSure'),
        text: t('systemControls.rebootConfirm'),
        confirmButtonText: t('systemControls.reboot'),
        endpoint: '/api/v2/reboot',
        successMessage: t('systemControls.rebootSuccess'),
        errorMessage: t('systemControls.rebootError'),
      },
      shutdown: {
        title: t('common.areYouSure'),
        text: t('systemControls.shutdownConfirm'),
        confirmButtonText: t('systemControls.shutdown'),
        endpoint: '/api/v2/shutdown',
        successMessage: t('systemControls.shutdownSuccess'),
        errorMessage: t('systemControls.shutdownError'),
      },
    }

    const { title, text, confirmButtonText, endpoint, successMessage } =
      config[operation]

    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: t('common.cancel'),
      reverseButtons: true,
      cancelButtonColor: '#6c757d',
      customClass: {
        popup: 'swal2-popup',
        title: 'swal2-title',
        htmlContainer: 'swal2-html-container',
        confirmButton: 'swal2-confirm',
        cancelButton: 'swal2-cancel',
        actions: 'swal2-actions',
      },
    })

    if (result.isConfirmed) {
      try {
        await dispatch(
          systemOperation({ operation, endpoint, successMessage }),
        ).unwrap()

        await Swal.fire({
          title: t('common.success'),
          text: successMessage,
          icon: 'success',
          timer: SWEETALERT_TIMER,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-popup',
            title: 'swal2-title',
            htmlContainer: 'swal2-html-container',
          },
        })
      } catch (err) {
        await Swal.fire({
          title: t('common.error'),
          text:
            (err as Error).message || t('common.operationFailed'),
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
  }

  const handleReboot = () => handleSystemOperation('reboot')
  const handleShutdown = () => handleSystemOperation('shutdown')

  return (
    <>
      <div className="row py-2 mt-4">
        <div className="col-12">
          <h4 className="page-header text-white">
            <b>{t('systemControls.title')}</b>
          </h4>
        </div>
      </div>
      <div className="row content px-3">
        <div className="col-12 my-3">
          <div className="text-end">
            <button
              className="btn btn-danger btn-long me-2"
              type="button"
              onClick={handleReboot}
            >
              {t('systemControls.reboot')}
            </button>
            <button
              className="btn btn-danger btn-long"
              type="button"
              onClick={handleShutdown}
            >
              {t('systemControls.shutdown')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
