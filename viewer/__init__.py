# -*- coding: utf-8 -*-

from __future__ import unicode_literals

import json
import logging
import sys
import threading
from builtins import range
from os import getenv, path
from signal import SIGALRM, signal
from time import sleep

import django
import pydbus
import sh
from future import standard_library
from jinja2 import Template
from tenacity import Retrying, stop_after_attempt, wait_fixed

from settings import LISTEN, ZmqConsumer, settings
from viewer.constants import (
    BALENA_IP_RETRY_DELAY,
    EMPTY_PL_DELAY,
    MAX_BALENA_IP_RETRIES,
    SCHEDULE_CHECK_INTERVAL,
    SERVER_WAIT_TIMEOUT,
    SPLASH_DELAY,
    SPLASH_PAGE_URL,
    STANDBY_SCREEN,
)
from viewer.cec_controller import CecController
from viewer.ir_controller import IrController
from viewer.media_player import MediaPlayerProxy
from viewer.playback import navigate_to_asset, play_loop, skip_asset, stop_loop
from viewer.utils import (
    command_not_found,
    get_skip_event,
    sigalrm,
    wait_for_server,
    watchdog,
)

try:
    django.setup()

    # Place imports that uses Django in this block.

    from lib.utils import (
        connect_to_redis,
        get_balena_device_info,
        get_node_ip,
        is_balena_app,
        string_to_bool,
        url_fails,
    )
    from viewer.scheduling import Scheduler
    from viewer.zmq import ZMQ_HOST_PUB_URL, ZmqSubscriber
except Exception:
    pass

standard_library.install_aliases()


__author__ = 'Screenly, Inc'
__copyright__ = 'Copyright 2012-2024, Screenly, Inc'
__license__ = 'Dual License: GPLv2 and Commercial License'


current_browser_url = None
browser = None
loop_is_stopped = False
browser_bus = None
r = connect_to_redis()

HOME = None

scheduler = None


def send_current_asset_id_to_server():
    consumer = ZmqConsumer()
    consumer.send({'current_asset_id': scheduler.current_asset_id})


def show_hotspot_page(data):
    global loop_is_stopped

    uri = 'http://{0}/hotspot'.format(LISTEN)
    decoded = json.loads(data)

    base_dir = path.abspath(path.dirname(__file__))
    template_path = path.join(base_dir, 'templates/hotspot.html')

    with open(template_path) as f:
        template = Template(f.read())

    context = {
        'network': decoded.get('network', None),
        'ssid_pswd': decoded.get('ssid_pswd', None),
        'address': decoded.get('address', None),
    }

    with open('/data/hotspot/hotspot.html', 'w') as out_file:
        out_file.write(template.render(context=context))

    loop_is_stopped = stop_loop(scheduler)
    view_webpage(uri)


def setup_wifi(data):
    global load_screen_displayed, mq_data
    if not load_screen_displayed:
        mq_data = data
        return

    show_hotspot_page(data)


def show_splash(data):
    global loop_is_stopped

    if is_balena_app():
        while True:
            try:
                ip_address = get_balena_device_info().json()['ip_address']
                if ip_address != '':
                    break
            except Exception:
                break
    else:
        r.set('ip_addresses', data)

    view_webpage(SPLASH_PAGE_URL)
    sleep(SPLASH_DELAY)
    loop_is_stopped = play_loop()


commands = {
    'next': lambda _: skip_asset(scheduler),
    'previous': lambda _: skip_asset(scheduler, back=True),
    'asset': lambda asset_id: navigate_to_asset(scheduler, asset_id),
    'reload': lambda _: load_settings(),
    'stop': lambda _: setattr(
        __import__('__main__'), 'loop_is_stopped', stop_loop(scheduler)
    ),
    'play': lambda _: setattr(
        __import__('__main__'), 'loop_is_stopped', play_loop()
    ),
    'setup_wifi': lambda data: setup_wifi(data),
    'show_splash': lambda data: show_splash(data),
    'unknown': lambda _: command_not_found(),
    'current_asset_id': lambda _: send_current_asset_id_to_server(),
}


def load_browser():
    global browser
    logging.info('Loading browser...')

    browser = sh.Command('ScreenlyWebview')(_bg=True, _err_to_out=True)
    while 'Screenly service start' not in browser.process.stdout.decode(
        'utf-8'
    ):
        sleep(1)


def view_webpage(uri):
    global current_browser_url

    if browser is None or not browser.process.alive:
        load_browser()
    if current_browser_url is not uri:
        browser_bus.loadPage(uri)
        current_browser_url = uri
    logging.info('Current url is {0}'.format(current_browser_url))


def view_image(uri):
    global current_browser_url

    if browser is None or not browser.process.alive:
        load_browser()
    if current_browser_url is not uri:
        browser_bus.loadImage(uri)
        current_browser_url = uri
    logging.info('Current url is {0}'.format(current_browser_url))

    if string_to_bool(getenv('WEBVIEW_DEBUG', '0')):
        logging.info(browser.process.stdout)


def view_video(uri, duration, scheduler=None):
    logging.debug('Displaying video %s for %s ', uri, duration)
    media_player = MediaPlayerProxy.get_instance()

    media_player.set_asset(uri, duration)
    media_player.play()

    view_image('null')

    try:
        skip_event = get_skip_event()
        skip_event.clear()
        remaining = int(duration)
        infinite = (remaining == 0)
        poll_interval = 2  # check ffplay every 2 seconds
        elapsed_since_check = 0
        while infinite or remaining > 0:
            wait_time = min(poll_interval, remaining) if not infinite else poll_interval
            if skip_event.wait(timeout=wait_time):
                logging.info('Skip detected during video playback, stopping video')
                media_player.stop()
                return
            if not infinite:
                remaining -= wait_time
            if not media_player.is_playing():
                logging.warning('Video playback ended (process exited), moving on')
                break
            # Periodic schedule re-check (catches new slots added mid-playback)
            elapsed_since_check += wait_time
            if scheduler and elapsed_since_check >= SCHEDULE_CHECK_INTERVAL:
                elapsed_since_check = 0
                if scheduler.should_refresh():
                    logging.info('Schedule changed during video, interrupting')
                    break
    except sh.ErrorReturnCode_1:
        logging.info(
            'Resource URI is not correct, remote host is not responding or '
            'request was rejected.'
        )

    media_player.stop()


def _log_playback(asset):
    """Write a viewlog entry to viewlog.db (read by phone-home and screenshot API)."""
    try:
        import sqlite3
        from datetime import datetime, timezone as tz
        db_path = path.join(path.expanduser('~'), '.screenly', 'viewlog.db')
        conn = sqlite3.connect(db_path, timeout=5)
        conn.execute(
            'CREATE TABLE IF NOT EXISTS viewlog '
            '(id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id TEXT, asset_name TEXT, '
            'mimetype TEXT, started_at TEXT)'
        )
        conn.execute(
            'INSERT INTO viewlog (asset_id, asset_name, mimetype, started_at) VALUES (?, ?, ?, ?)',
            (
                asset.get('asset_id', ''),
                asset.get('name', ''),
                asset.get('mimetype', ''),
                datetime.now(tz.utc).isoformat(),
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logging.debug('Failed to write viewlog: %s', e)


def load_settings():
    """
    Load settings and set the log level.
    """
    settings.load()
    logging.getLogger().setLevel(
        logging.DEBUG if settings['debug_logging'] else logging.INFO
    )


def _is_cctv_url(uri):
    """Check if URL is a CCTV stream from Fleet Manager."""
    return '/cctv/' in uri


def _parse_cctv_url(uri):
    """Extract base_url and config_id from CCTV URL.

    Input:  http://FM:9000/cctv/<config_id>/
    Returns: (base_url, config_id) or (None, None)
    """
    parts = uri.rstrip('/').split('/cctv/')
    if len(parts) != 2:
        return None, None
    return parts[0], parts[1].rstrip('/')


def _get_cctv_hls_url(uri):
    """Get HLS stream URL from CCTV page URL."""
    base_url, config_id = _parse_cctv_url(uri)
    if not base_url:
        return None
    return f'{base_url}/media/cctv/{config_id}/stream.m3u8'


def _request_cctv_start(uri):
    """Ask FM to start CCTV stream. Returns True when HLS stream is ready."""
    import requests as req
    try:
        base_url, config_id = _parse_cctv_url(uri)
        if not base_url:
            return False
        resp = req.post(
            f'{base_url}/api/cctv/{config_id}/request-start/',
            timeout=10,
        )
        if resp.status_code != 200:
            logging.warning(
                'CCTV request-start returned %s', resp.status_code
            )
            return False
        # Wait for HLS stream to be ready (m3u8 file)
        hls_url = f'{base_url}/media/cctv/{config_id}/stream.m3u8'
        for _ in range(15):
            sleep(1)
            try:
                r = req.head(hls_url, timeout=3)
                if r.status_code == 200:
                    logging.info('CCTV HLS stream ready: %s', config_id)
                    return True
            except Exception:
                pass
        logging.warning('CCTV HLS stream not ready after 15s, proceeding anyway')
        return True  # proceed anyway after timeout
    except Exception:
        logging.warning('CCTV request-start failed for %s', uri, exc_info=True)
        return False


def _cctv_keepalive(uri, stop_event):
    """Send keepalive pings to FM every 60s while CCTV is playing."""
    import requests as req
    base_url, config_id = _parse_cctv_url(uri)
    if not base_url:
        return
    api_url = f'{base_url}/api/cctv/{config_id}/request-start/'
    while not stop_event.wait(timeout=60):
        try:
            req.post(api_url, timeout=5)
            logging.debug('CCTV keepalive sent for %s', config_id)
        except Exception:
            logging.warning('CCTV keepalive failed for %s', config_id)


def asset_loop(scheduler, cec=None):
    asset = scheduler.get_next_asset()

    if asset is None:
        logging.info('Playlist is empty. TV standby, waiting for content.')
        if cec:
            cec.standby()
        skip_event = get_skip_event()
        skip_event.clear()
        skip_event.wait(timeout=EMPTY_PL_DELAY)
        return

    # Content available — ensure TV is on
    if cec:
        cec.wake()
        cec.set_volume(asset.get('volume'), asset.get('mute', False))

    if path.isfile(asset['uri']) or (
        not url_fails(asset['uri']) or asset['skip_asset_check']
    ):
        name, mime, uri = asset['name'], asset['mimetype'], asset['uri']
        logging.info('Showing asset %s (%s)', name, mime)
        logging.debug('Asset URI %s', uri)
        watchdog()
        _log_playback(asset)

        if 'image' in mime:
            view_image(uri)
        elif 'web' in mime:
            if _is_cctv_url(uri):
                if not _request_cctv_start(uri):
                    logging.info(
                        'CCTV stream %s unavailable, skipping', name
                    )
                    skip_event = get_skip_event()
                    skip_event.clear()
                    skip_event.wait(timeout=0.5)
                    return
                # Play HLS stream directly via VLC/ffplay
                hls_url = _get_cctv_hls_url(uri)
                if hls_url:
                    logging.info('Playing CCTV HLS stream: %s', hls_url)
                    keepalive_stop = threading.Event()
                    keepalive_thread = threading.Thread(
                        target=_cctv_keepalive,
                        args=(uri, keepalive_stop),
                        daemon=True,
                    )
                    keepalive_thread.start()
                    try:
                        view_video(hls_url, asset['duration'], scheduler)
                    finally:
                        keepalive_stop.set()
                        keepalive_thread.join(timeout=5)
                    return
            view_webpage(uri)
        elif 'video' or 'streaming' in mime:
            view_video(uri, asset['duration'], scheduler)
        else:
            logging.error('Unknown MimeType %s', mime)

        if 'image' in mime or 'web' in mime:
            duration = int(asset['duration'])
            infinite = (duration == 0)
            if infinite:
                logging.info('Infinite duration — playing until schedule change')
            else:
                logging.info('Sleeping for %s', duration)
            skip_event = get_skip_event()
            skip_event.clear()
            remaining = duration if not infinite else None
            while True:
                wait_time = min(SCHEDULE_CHECK_INTERVAL, remaining) if remaining else SCHEDULE_CHECK_INTERVAL
                if skip_event.wait(timeout=wait_time):
                    logging.info('Skip detected, moving to next asset immediately')
                    break
                if remaining is not None:
                    remaining -= wait_time
                    if remaining <= 0:
                        break  # duration elapsed
                # Periodic schedule re-check
                if scheduler.should_refresh():
                    logging.info('Schedule changed during playback, moving on')
                    break

    else:
        logging.info(
            'Asset %s at %s is not available, skipping.',
            asset['name'],
            asset['uri'],
        )
        skip_event = get_skip_event()
        skip_event.clear()
        if skip_event.wait(timeout=0.5):
            # Skip was triggered, continue immediately to next iteration
            logging.info(
                'Skip detected during asset unavailability wait, continuing'
            )
        else:
            # Duration elapsed normally, continue to next iteration
            pass


def setup():
    global HOME, browser_bus
    HOME = getenv('HOME')
    if not HOME:
        logging.error('No HOME variable')

        # Alternatively, we can raise an Exception using a custom message,
        # or we can create a new class that extends Exception.
        sys.exit(1)

    # Skip event is now handled via threading instead of signals
    signal(SIGALRM, sigalrm)

    load_settings()
    load_browser()

    bus = pydbus.SessionBus()
    browser_bus = bus.get('screenly.webview', '/Screenly')


def wait_for_node_ip(seconds):
    for _ in range(seconds):
        try:
            get_node_ip()
            break
        except Exception:
            sleep(1)


def start_loop():
    global loop_is_stopped

    ir = IrController()
    cec = CecController(ir_controller=ir)
    logging.debug('Entering infinite loop.')
    while True:
        if loop_is_stopped:
            sleep(0.1)
            continue

        asset_loop(scheduler, cec)


def main():
    global scheduler
    global load_screen_displayed, mq_data

    load_screen_displayed = False
    mq_data = None

    setup()

    subscriber_1 = ZmqSubscriber(r, commands, 'tcp://anthias-server:10001')
    subscriber_1.daemon = True
    subscriber_1.start()

    subscriber_2 = ZmqSubscriber(r, commands, ZMQ_HOST_PUB_URL)
    subscriber_2.daemon = True
    subscriber_2.start()

    # This will prevent white screen from happening before showing the
    # splash screen with IP addresses.
    view_image(STANDBY_SCREEN)

    wait_for_server(SERVER_WAIT_TIMEOUT)

    scheduler = Scheduler()

    if settings['show_splash']:
        if is_balena_app():
            for attempt in Retrying(
                stop=stop_after_attempt(MAX_BALENA_IP_RETRIES),
                wait=wait_fixed(BALENA_IP_RETRY_DELAY),
            ):
                with attempt:
                    get_balena_device_info()

        view_webpage(SPLASH_PAGE_URL)
        sleep(SPLASH_DELAY)

    # We don't want to show splash page if there are active assets but all of
    # them are not available.
    view_image(STANDBY_SCREEN)

    load_screen_displayed = True

    if mq_data is not None:
        show_hotspot_page(mq_data)
        mq_data = None

    sleep(0.5)

    start_loop()
