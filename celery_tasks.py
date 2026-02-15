import json
import logging
from datetime import datetime, timedelta
from os import getenv, path

import django
import sh
from celery import Celery
from tenacity import Retrying, stop_after_attempt, wait_fixed

try:
    django.setup()

    # Place imports that uses Django in this block.

    from lib import diagnostics
    from lib.utils import (
        connect_to_redis,
        is_balena_app,
        reboot_via_balena_supervisor,
        shutdown_via_balena_supervisor,
    )
except Exception:
    pass


__author__ = 'Screenly, Inc'
__copyright__ = 'Copyright 2012-2024, Screenly, Inc'
__license__ = 'Dual License: GPLv2 and Commercial License'


CELERY_RESULT_BACKEND = getenv(
    'CELERY_RESULT_BACKEND', 'redis://localhost:6379/0'
)
CELERY_BROKER_URL = getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_TASK_RESULT_EXPIRES = timedelta(hours=6)

r = connect_to_redis()
celery = Celery(
    'Anthias Celery Worker',
    backend=CELERY_RESULT_BACKEND,
    broker=CELERY_BROKER_URL,
    result_expires=CELERY_TASK_RESULT_EXPIRES,
)


@celery.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Calls cleanup() every hour.
    sender.add_periodic_task(3600, cleanup.s(), name='cleanup')
    sender.add_periodic_task(
        60 * 5, get_display_power.s(), name='display_power'
    )
    sender.add_periodic_task(
        60, enforce_display_schedule.s(), name='display_schedule'
    )


@celery.task(time_limit=30)
def get_display_power():
    r.set('display_power', diagnostics.get_display_power())
    r.expire('display_power', 3600)


@celery.task
def cleanup():
    sh.find(
        path.join(getenv('HOME'), 'screenly_assets'),
        '-name',
        '*.tmp',
        '-delete',
    )


@celery.task
def reboot_anthias():
    """
    Background task to reboot Anthias
    """
    if is_balena_app():
        for attempt in Retrying(
            stop=stop_after_attempt(5),
            wait=wait_fixed(1),
        ):
            with attempt:
                reboot_via_balena_supervisor()
    else:
        r.publish('hostcmd', 'reboot')


@celery.task
def shutdown_anthias():
    """
    Background task to shutdown Anthias
    """
    if is_balena_app():
        for attempt in Retrying(
            stop=stop_after_attempt(5),
            wait=wait_fixed(1),
        ):
            with attempt:
                shutdown_via_balena_supervisor()
    else:
        r.publish('hostcmd', 'shutdown')


@celery.task(time_limit=30)
def enforce_display_schedule():
    """
    Reads display_power_schedule from settings and sends CEC
    power_on/standby commands when the desired state changes.
    """
    from settings import settings as app_settings

    try:
        app_settings.load()
        raw = app_settings.get('display_power_schedule', '')
        if not raw:
            return

        schedule = json.loads(raw)
        if not isinstance(schedule, dict) or not schedule.get('enabled'):
            return

        days = schedule.get('days', {})
        now = datetime.now()
        day_key = str(now.isoweekday())  # 1=Mon .. 7=Sun
        day_cfg = days.get(day_key)

        if day_cfg is None:
            # null = screen off all day
            desired_on = False
        else:
            on_time = day_cfg.get('on', '00:00')
            off_time = day_cfg.get('off', '23:59')
            current_time = now.strftime('%H:%M')

            if on_time <= off_time:
                # Normal: e.g. 08:00 - 22:00
                desired_on = on_time <= current_time < off_time
            else:
                # Overnight: e.g. 22:00 - 06:00
                desired_on = current_time >= on_time or current_time < off_time

        # Check if state changed since last enforcement
        desired_str = '1' if desired_on else '0'
        last_desired = r.get('display_schedule_desired')
        if last_desired is not None:
            last_desired = last_desired.decode() if isinstance(last_desired, bytes) else str(last_desired)
        if last_desired == desired_str:
            return  # No change needed

        result = diagnostics.set_display_power(desired_on)
        if result:
            r.set('display_schedule_desired', desired_str, ex=120)
            logging.info(
                'Display schedule: turned %s (day=%s, time=%s)',
                'ON' if desired_on else 'OFF', day_key, now.strftime('%H:%M')
            )
    except (json.JSONDecodeError, TypeError, KeyError) as e:
        logging.warning('Display schedule error: %s', e)
    except Exception as e:
        logging.error('Display schedule unexpected error: %s', e)
