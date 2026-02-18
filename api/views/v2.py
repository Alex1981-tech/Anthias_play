import hashlib
import io
import ipaddress
import json
import logging
import struct
import subprocess
import time
from datetime import timedelta
from os import getenv, path, statvfs
from platform import machine

import psutil
from drf_spectacular.utils import extend_schema
from django.http import HttpResponse
from hurry.filesize import size
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from anthias_app.helpers import add_default_assets, remove_default_assets
from anthias_app.models import Asset
from api.helpers import (
    AssetCreationError,
    get_active_asset_ids,
    save_active_assets_ordering,
)
from api.serializers.v2 import (
    AssetSerializerV2,
    CreateAssetSerializerV2,
    DeviceSettingsSerializerV2,
    IntegrationsSerializerV2,
    UpdateAssetSerializerV2,
    UpdateDeviceSettingsSerializerV2,
)
from api.views.mixins import (
    AssetContentViewMixin,
    AssetsControlViewMixin,
    BackupViewMixin,
    DeleteAssetViewMixin,
    FileAssetViewMixin,
    InfoViewMixin,
    PlaylistOrderViewMixin,
    RebootViewMixin,
    RecoverViewMixin,
    ShutdownViewMixin,
)
from lib import device_helper, diagnostics
from lib.auth import authorized
from lib.github import is_up_to_date
from lib.utils import (
    connect_to_redis,
    get_node_ip,
    get_node_mac_address,
    is_balena_app,
)
from settings import ZmqPublisher, settings

r = connect_to_redis()


class AssetListViewV2(APIView):
    serializer_class = AssetSerializerV2

    @extend_schema(
        summary='List assets', responses={200: AssetSerializerV2(many=True)}
    )
    @authorized
    def get(self, request):
        queryset = Asset.objects.all()
        serializer = AssetSerializerV2(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary='Create asset',
        request=CreateAssetSerializerV2,
        responses={201: AssetSerializerV2},
    )
    @authorized
    def post(self, request):
        try:
            serializer = CreateAssetSerializerV2(
                data=request.data, unique_name=True
            )

            if not serializer.is_valid():
                raise AssetCreationError(serializer.errors)
        except AssetCreationError as error:
            return Response(error.errors, status=status.HTTP_400_BAD_REQUEST)

        active_asset_ids = get_active_asset_ids()
        asset = Asset.objects.create(**serializer.data)
        asset.refresh_from_db()

        if asset.is_active():
            active_asset_ids.insert(asset.play_order, asset.asset_id)

        save_active_assets_ordering(active_asset_ids)
        asset.refresh_from_db()

        return Response(
            AssetSerializerV2(asset).data,
            status=status.HTTP_201_CREATED,
        )


class AssetViewV2(APIView, DeleteAssetViewMixin):
    serializer_class = AssetSerializerV2

    @extend_schema(summary='Get asset')
    @authorized
    def get(self, request, asset_id):
        asset = Asset.objects.get(asset_id=asset_id)
        serializer = self.serializer_class(asset)
        return Response(serializer.data)

    def update(self, request, asset_id, partial=False):
        asset = Asset.objects.get(asset_id=asset_id)
        serializer = UpdateAssetSerializerV2(
            asset, data=request.data, partial=partial
        )

        if serializer.is_valid():
            serializer.save()
        else:
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST
            )

        active_asset_ids = get_active_asset_ids()

        asset.refresh_from_db()

        try:
            active_asset_ids.remove(asset.asset_id)
        except ValueError:
            pass

        if asset.is_active():
            active_asset_ids.insert(asset.play_order, asset.asset_id)

        save_active_assets_ordering(active_asset_ids)
        asset.refresh_from_db()

        return Response(AssetSerializerV2(asset).data)

    @extend_schema(
        summary='Update asset',
        request=UpdateAssetSerializerV2,
        responses={200: AssetSerializerV2},
    )
    @authorized
    def patch(self, request, asset_id):
        return self.update(request, asset_id, partial=True)

    @extend_schema(
        summary='Update asset',
        request=UpdateAssetSerializerV2,
        responses={200: AssetSerializerV2},
    )
    @authorized
    def put(self, request, asset_id):
        return self.update(request, asset_id, partial=False)


class BackupViewV2(BackupViewMixin):
    pass


class RecoverViewV2(RecoverViewMixin):
    pass


class RebootViewV2(RebootViewMixin):
    pass


class ShutdownViewV2(ShutdownViewMixin):
    pass


class FileAssetViewV2(FileAssetViewMixin):
    pass


class AssetContentViewV2(AssetContentViewMixin):
    pass


class PlaylistOrderViewV2(PlaylistOrderViewMixin):
    pass


class AssetsControlViewV2(AssetsControlViewMixin):
    pass


class DeviceSettingsViewV2(APIView):
    @extend_schema(
        summary='Get device settings',
        responses={200: DeviceSettingsSerializerV2},
    )
    @authorized
    def get(self, request):
        try:
            # Force reload of settings
            settings.load()
        except Exception as e:
            logging.error(f'Failed to reload settings: {str(e)}')
            # Continue with existing settings if reload fails

        schedule_raw = settings.get('display_power_schedule', '')
        try:
            display_schedule = json.loads(schedule_raw) if schedule_raw else None
        except (json.JSONDecodeError, TypeError):
            display_schedule = None

        return Response(
            {
                'player_name': settings['player_name'],
                'audio_output': settings['audio_output'],
                'default_duration': int(settings['default_duration']),
                'default_streaming_duration': int(
                    settings['default_streaming_duration']
                ),
                'date_format': settings['date_format'],
                'auth_backend': settings['auth_backend'],
                'resolution': settings['resolution'],
                'show_splash': settings['show_splash'],
                'default_assets': settings['default_assets'],
                'shuffle_playlist': settings['shuffle_playlist'],
                'use_24_hour_clock': settings['use_24_hour_clock'],
                'debug_logging': settings['debug_logging'],
                'username': (
                    settings['user']
                    if settings['auth_backend'] == 'auth_basic'
                    else ''
                ),
                'display_power_schedule': display_schedule,
                'language': settings.get('language', 'en'),
                'ir_enabled': settings.get('ir_enabled', False),
                'ir_protocol': settings.get('ir_protocol', ''),
                'ir_power_scancode': settings.get('ir_power_scancode', ''),
            }
        )

    def update_auth_settings(self, data, auth_backend, current_pass_correct):
        if auth_backend == '':
            return

        if auth_backend != 'auth_basic':
            return

        new_user = data.get('username', '')
        new_pass = data.get('password', '').encode('utf-8')
        new_pass2 = data.get('password_2', '').encode('utf-8')
        new_pass = hashlib.sha256(new_pass).hexdigest() if new_pass else None
        new_pass2 = hashlib.sha256(new_pass2).hexdigest() if new_pass else None

        if settings['password']:
            if new_user != settings['user']:
                if current_pass_correct is None:
                    raise ValueError(
                        'Must supply current password to change username'
                    )
                if not current_pass_correct:
                    raise ValueError('Incorrect current password.')

                settings['user'] = new_user

            if new_pass:
                if current_pass_correct is None:
                    raise ValueError(
                        'Must supply current password to change password'
                    )
                if not current_pass_correct:
                    raise ValueError('Incorrect current password.')

                if new_pass2 != new_pass:
                    raise ValueError('New passwords do not match!')

                settings['password'] = new_pass

        else:
            if new_user:
                if new_pass and new_pass != new_pass2:
                    raise ValueError('New passwords do not match!')
                if not new_pass:
                    raise ValueError('Must provide password')
                settings['user'] = new_user
                settings['password'] = new_pass
            else:
                raise ValueError('Must provide username')

    @extend_schema(
        summary='Update device settings',
        request=UpdateDeviceSettingsSerializerV2,
        responses={
            200: {
                'type': 'object',
                'properties': {'message': {'type': 'string'}},
            },
            400: {
                'type': 'object',
                'properties': {'error': {'type': 'string'}},
            },
        },
    )
    @authorized
    def patch(self, request):
        try:
            serializer = UpdateDeviceSettingsSerializerV2(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)

            data = serializer.validated_data
            settings.load()

            current_password = data.get('current_password', '')
            auth_backend = data.get('auth_backend', '')

            if (
                auth_backend != settings['auth_backend']
                and settings['auth_backend']
            ):
                if not current_password:
                    raise ValueError(
                        'Must supply current password to change '
                        'authentication method'
                    )
                if not settings.auth.check_password(current_password):
                    raise ValueError('Incorrect current password.')

            prev_auth_backend = settings['auth_backend']
            if not current_password and prev_auth_backend:
                current_pass_correct = None
            else:
                current_pass_correct = settings.auth_backends[
                    prev_auth_backend
                ].check_password(current_password)
            next_auth_backend = settings.auth_backends[auth_backend]

            self.update_auth_settings(
                data, next_auth_backend.name, current_pass_correct
            )
            settings['auth_backend'] = auth_backend

            # Update settings
            if 'player_name' in data:
                settings['player_name'] = data['player_name']
            if 'default_duration' in data:
                settings['default_duration'] = data['default_duration']
            if 'default_streaming_duration' in data:
                settings['default_streaming_duration'] = data[
                    'default_streaming_duration'
                ]
            if 'audio_output' in data:
                settings['audio_output'] = data['audio_output']
            if 'date_format' in data:
                settings['date_format'] = data['date_format']
            if 'show_splash' in data:
                settings['show_splash'] = data['show_splash']
            if 'default_assets' in data:
                if data['default_assets'] and not settings['default_assets']:
                    add_default_assets()
                elif not data['default_assets'] and settings['default_assets']:
                    remove_default_assets()
                settings['default_assets'] = data['default_assets']
            if 'shuffle_playlist' in data:
                settings['shuffle_playlist'] = data['shuffle_playlist']
            if 'use_24_hour_clock' in data:
                settings['use_24_hour_clock'] = data['use_24_hour_clock']
            if 'debug_logging' in data:
                settings['debug_logging'] = data['debug_logging']
            if 'resolution' in data:
                settings['resolution'] = data['resolution']
            if 'language' in data:
                settings['language'] = data['language']
            if 'ir_enabled' in data:
                settings['ir_enabled'] = data['ir_enabled']
            if 'ir_protocol' in data:
                settings['ir_protocol'] = data['ir_protocol']
            if 'ir_power_scancode' in data:
                settings['ir_power_scancode'] = data['ir_power_scancode']

            # Handle display_power_schedule from raw request data
            # (may arrive as dict or JSON string)
            if 'display_power_schedule' in request.data:
                val = request.data['display_power_schedule']
                if val is None or val == '':
                    settings['display_power_schedule'] = ''
                elif isinstance(val, dict):
                    settings['display_power_schedule'] = json.dumps(val)
                else:
                    settings['display_power_schedule'] = str(val)

            settings.save()
            publisher = ZmqPublisher.get_instance()
            publisher.send_to_viewer('reload')

            return Response({'message': 'Settings were successfully saved.'})
        except Exception as e:
            return Response(
                {'error': f'An error occurred while saving settings: {e}'},
                status=400,
            )


class InfoViewV2(InfoViewMixin):
    def get_anthias_version(self):
        app_version = getenv('APP_VERSION', '')
        git_short_hash = diagnostics.get_git_short_hash() or 'unknown'

        if app_version and app_version != 'dev':
            return 'v{}@{}'.format(app_version, git_short_hash)

        git_branch = diagnostics.get_git_branch() or 'dev'
        return '{}@{}'.format(git_branch, git_short_hash)

    def get_device_model(self):
        device_model = device_helper.parse_cpu_info().get('model')

        if device_model is None and machine() == 'x86_64':
            device_model = 'Generic x86_64 Device'

        return device_model

    def get_uptime(self):
        system_uptime = timedelta(seconds=diagnostics.get_uptime())
        return {
            'days': system_uptime.days,
            'hours': round(system_uptime.seconds / 3600, 2),
        }

    def get_memory(self):
        virtual_memory = psutil.virtual_memory()
        return {
            'total': virtual_memory.total >> 20,
            'used': virtual_memory.used >> 20,
            'free': virtual_memory.free >> 20,
            'shared': virtual_memory.shared >> 20,
            'buff': virtual_memory.buffers >> 20,
            'available': virtual_memory.available >> 20,
        }

    def get_ip_addresses(self):
        ip_addresses = []
        node_ip = get_node_ip()

        if node_ip == 'Unable to retrieve IP.':
            return []

        for ip_address in node_ip.split():
            ip_address_object = ipaddress.ip_address(ip_address)

            if isinstance(ip_address_object, ipaddress.IPv6Address):
                ip_addresses.append(f'http://[{ip_address}]')
            else:
                ip_addresses.append(f'http://{ip_address}')

        return ip_addresses

    def get_cpu_temp(self):
        try:
            temps = psutil.sensors_temperatures()
            if 'cpu_thermal' in temps and temps['cpu_thermal']:
                return round(temps['cpu_thermal'][0].current, 1)
        except Exception:
            pass
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                return round(int(f.read().strip()) / 1000, 1)
        except Exception:
            return None

    def get_cpu_usage(self):
        try:
            return psutil.cpu_percent(interval=None)
        except Exception:
            return 0.0

    def get_cpu_freq(self):
        try:
            freq = psutil.cpu_freq()
            if freq:
                return {
                    'current': int(freq.current),
                    'max': int(freq.max) if freq.max else int(freq.current),
                }
        except Exception:
            pass
        return None

    def get_throttle_state(self):
        try:
            result = subprocess.run(
                ['vcgencmd', 'get_throttled'],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                # Output: throttled=0x50000
                val = result.stdout.strip().split('=')[-1]
                return int(val, 16)
        except Exception:
            pass
        return None

    def get_disk_usage(self):
        try:
            usage = psutil.disk_usage('/')
            return {
                'total_gb': round(usage.total / (1024 ** 3), 1),
                'used_gb': round(usage.used / (1024 ** 3), 1),
                'free_gb': round(usage.free / (1024 ** 3), 1),
                'percent': usage.percent,
            }
        except Exception:
            return None

    @extend_schema(
        summary='Get system information',
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'viewlog': {'type': 'string'},
                    'loadavg': {'type': 'number'},
                    'free_space': {'type': 'string'},
                    'display_power': {'type': ['string', 'null']},
                    'up_to_date': {'type': 'boolean'},
                    'anthias_version': {'type': 'string'},
                    'device_model': {'type': 'string'},
                    'uptime': {
                        'type': 'object',
                        'properties': {
                            'days': {'type': 'integer'},
                            'hours': {'type': 'number'},
                        },
                    },
                    'memory': {
                        'type': 'object',
                        'properties': {
                            'total': {'type': 'integer'},
                            'used': {'type': 'integer'},
                            'free': {'type': 'integer'},
                            'shared': {'type': 'integer'},
                            'buff': {'type': 'integer'},
                            'available': {'type': 'integer'},
                        },
                    },
                    'ip_addresses': {
                        'type': 'array',
                        'items': {'type': 'string'},
                    },
                    'mac_address': {'type': 'string'},
                    'host_user': {'type': 'string'},
                    'cpu_temp': {'type': ['number', 'null']},
                    'cpu_usage': {'type': 'number'},
                    'cpu_freq': {
                        'type': ['object', 'null'],
                        'properties': {
                            'current': {'type': 'integer'},
                            'max': {'type': 'integer'},
                        },
                    },
                    'throttle_state': {'type': ['integer', 'null']},
                    'disk_usage': {
                        'type': ['object', 'null'],
                        'properties': {
                            'total_gb': {'type': 'number'},
                            'used_gb': {'type': 'number'},
                            'free_gb': {'type': 'number'},
                            'percent': {'type': 'number'},
                        },
                    },
                },
            }
        },
    )
    @authorized
    def get(self, request):
        viewlog = 'Not yet implemented'

        # Calculate disk space
        slash = statvfs('/')
        free_space = size(slash.f_bavail * slash.f_frsize)
        display_power = r.get('display_power')

        return Response(
            {
                'viewlog': viewlog,
                'loadavg': diagnostics.get_load_avg()['15 min'],
                'free_space': free_space,
                'display_power': display_power,
                'up_to_date': is_up_to_date(),
                'anthias_version': self.get_anthias_version(),
                'device_model': self.get_device_model(),
                'uptime': self.get_uptime(),
                'memory': self.get_memory(),
                'ip_addresses': self.get_ip_addresses(),
                'mac_address': get_node_mac_address(),
                'host_user': getenv('HOST_USER'),
                'cpu_temp': self.get_cpu_temp(),
                'cpu_usage': self.get_cpu_usage(),
                'cpu_freq': self.get_cpu_freq(),
                'throttle_state': self.get_throttle_state(),
                'disk_usage': self.get_disk_usage(),
            }
        )


class ScreenshotViewV2(APIView):
    _cache = None
    _cache_time = 0
    CACHE_TTL = 5  # seconds

    @staticmethod
    def _get_current_video():
        """Check viewlog.db for a currently-playing video asset.

        Returns (file_path, seconds_elapsed) or (None, None).
        The viewer writes a row to viewlog on each asset start via _log_playback().
        """
        import sqlite3
        from datetime import datetime, timezone as tz

        db_path = path.join(
            path.expanduser('~'), '.screenly', 'viewlog.db'
        )
        if not path.exists(db_path):
            return None, None

        try:
            conn = sqlite3.connect(db_path, timeout=3)
            row = conn.execute(
                'SELECT asset_id, mimetype, started_at FROM viewlog '
                'ORDER BY id DESC LIMIT 1'
            ).fetchone()
            conn.close()
        except Exception:
            return None, None

        if not row:
            return None, None

        asset_id, mimetype, started_at = row
        if mimetype != 'video':
            return None, None

        # Calculate how far into the video we are
        try:
            start_dt = datetime.fromisoformat(started_at)
            elapsed = (datetime.now(tz.utc) - start_dt).total_seconds()
        except Exception:
            elapsed = 0

        if elapsed < 0:
            elapsed = 0

        # Check the asset still exists and get its duration
        try:
            asset = Asset.objects.get(asset_id=asset_id)
        except Asset.DoesNotExist:
            return None, None

        # If elapsed time exceeds duration, the video has finished
        if elapsed > asset.duration + 2:
            return None, None

        # Resolve file path
        file_path = asset.uri
        if not path.isfile(file_path):
            # Try assets directory
            from settings import settings as app_settings
            assets_dir = path.join(
                path.expanduser('~'), app_settings['assetdir']
            )
            candidate = path.join(assets_dir, f'{asset_id}.mp4')
            if path.isfile(candidate):
                file_path = candidate
            else:
                return None, None

        return file_path, elapsed

    @staticmethod
    def _ffmpeg_frame(video_path, seek_seconds, quality=70, width=None):
        """Extract a single frame from a video file using ffmpeg.

        Returns JPEG bytes or None on failure.
        """
        import subprocess

        seek = max(0, int(seek_seconds))
        cmd = [
            'ffmpeg', '-ss', str(seek),
            '-i', video_path,
            '-frames:v', '1',
            '-q:v', str(max(1, min(31, (100 - quality) * 31 // 100))),
        ]
        if width:
            cmd += ['-vf', f'scale={int(width)}:-1']
        cmd += ['-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']

        try:
            result = subprocess.run(
                cmd, capture_output=True, timeout=10,
            )
            if result.returncode == 0 and len(result.stdout) > 100:
                return result.stdout
        except Exception as e:
            logging.warning('ffmpeg frame extraction failed: %s', e)
        return None

    @extend_schema(
        summary='Take a screenshot of the current display',
        responses={
            200: {
                'type': 'string',
                'format': 'binary',
                'description': 'JPEG image',
            }
        },
    )
    @authorized
    def get(self, request):
        width = request.query_params.get('width', None)
        quality = int(request.query_params.get('quality', 70))
        quality = max(10, min(100, quality))

        now = time.time()
        if (
            ScreenshotViewV2._cache is not None
            and now - ScreenshotViewV2._cache_time < self.CACHE_TTL
            and width is None
        ):
            return HttpResponse(
                ScreenshotViewV2._cache,
                content_type='image/jpeg',
            )

        # If a video is currently playing, extract a frame via ffmpeg
        # (VLC uses hardware overlay on Pi4 which bypasses /dev/fb0)
        # Default to 640px wide for video to keep file size small (~30-50KB)
        video_path, elapsed = self._get_current_video()
        if video_path:
            video_width = width or '640'
            video_quality = min(quality, 60)
            jpeg_bytes = self._ffmpeg_frame(
                video_path, elapsed, video_quality, video_width
            )
            if jpeg_bytes:
                if width is None:
                    ScreenshotViewV2._cache = jpeg_bytes
                    ScreenshotViewV2._cache_time = now
                return HttpResponse(
                    jpeg_bytes, content_type='image/jpeg'
                )

        # Fallback: framebuffer capture (works for images and web pages)
        try:
            from PIL import Image
        except ImportError:
            return Response(
                {'error': 'Pillow is not installed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        fb_path = '/dev/fb0'
        if not path.exists(fb_path):
            return Response(
                {'error': 'Framebuffer /dev/fb0 not available'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            fb_size_path = '/sys/class/graphics/fb0/virtual_size'
            fb_bits_path = '/sys/class/graphics/fb0/bits_per_pixel'

            with open(fb_size_path) as f:
                fb_w, fb_h = [int(x) for x in f.read().strip().split(',')]
            with open(fb_bits_path) as f:
                bpp = int(f.read().strip())

            bytes_per_pixel = bpp // 8
            line_length = fb_w * bytes_per_pixel

            with open(fb_path, 'rb') as fb:
                raw = fb.read(line_length * fb_h)

            if bytes_per_pixel == 4:
                img = Image.frombytes('RGBA', (fb_w, fb_h), raw, 'raw', 'BGRA')
            elif bytes_per_pixel == 3:
                img = Image.frombytes('RGB', (fb_w, fb_h), raw, 'raw', 'BGR')
            elif bytes_per_pixel == 2:
                img = Image.frombytes('RGB', (fb_w, fb_h), raw, 'raw', 'BGR;16')
            else:
                return Response(
                    {'error': f'Unsupported bits_per_pixel: {bpp}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            img = img.convert('RGB')

            if width:
                w = int(width)
                ratio = w / img.width
                h = int(img.height * ratio)
                img = img.resize((w, h), Image.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=quality)
            jpeg_bytes = buf.getvalue()

            if width is None:
                ScreenshotViewV2._cache = jpeg_bytes
                ScreenshotViewV2._cache_time = now

            return HttpResponse(jpeg_bytes, content_type='image/jpeg')

        except Exception as e:
            logging.error(f'Screenshot error: {e}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class IntegrationsViewV2(APIView):
    serializer_class = IntegrationsSerializerV2

    @extend_schema(
        summary='Get integrations information',
        responses={200: IntegrationsSerializerV2},
    )
    @authorized
    def get(self, request):
        data = {
            'is_balena': is_balena_app(),
        }

        if data['is_balena']:
            data.update(
                {
                    'balena_device_id': getenv('BALENA_DEVICE_UUID'),
                    'balena_app_id': getenv('BALENA_APP_ID'),
                    'balena_app_name': getenv('BALENA_APP_NAME'),
                    'balena_supervisor_version': (
                        getenv('BALENA_SUPERVISOR_VERSION')
                    ),
                    'balena_host_os_version': (
                        getenv('BALENA_HOST_OS_VERSION')
                    ),
                    'balena_device_name_at_init': (
                        getenv('BALENA_DEVICE_NAME_AT_INIT')
                    ),
                }
            )

        serializer = self.serializer_class(data=data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)


class UpdateViewV2(APIView):
    """POST /api/v2/update — trigger Watchtower to pull and restart containers."""

    @authorized
    def post(self, request):
        import requests as req

        token = getenv('WATCHTOWER_TOKEN', 'anthias-player-update')
        try:
            resp = req.post(
                'http://watchtower:8080/v1/update',
                headers={'Authorization': f'Bearer {token}'},
                timeout=10,
            )
            return Response({'success': resp.status_code == 200})
        except Exception as e:
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


# ── CEC TV control ──

_cec_instance = None


def _get_cec():
    global _cec_instance
    if _cec_instance is None:
        import importlib.util
        _app_root = path.dirname(path.dirname(path.dirname(path.abspath(__file__))))
        spec = importlib.util.spec_from_file_location(
            'cec_controller',
            path.join(_app_root, 'viewer', 'cec_controller.py'),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _cec_instance = mod.CecController()
    return _cec_instance


class CecStatusViewV2(APIView):
    """GET /api/v2/cec/status — CEC availability and TV power state."""

    @authorized
    def get(self, request):
        return Response(_get_cec().get_status())


class CecStandbyViewV2(APIView):
    """POST /api/v2/cec/standby — Send TV to standby via HDMI-CEC."""

    @authorized
    def post(self, request):
        cec = _get_cec()
        cec.standby()
        return Response(cec.get_status())


class CecWakeViewV2(APIView):
    """POST /api/v2/cec/wake — Wake TV via HDMI-CEC."""

    @authorized
    def post(self, request):
        cec = _get_cec()
        cec.wake()
        return Response(cec.get_status())


# ── IR remote control ──

_ir_instance = None


def _get_ir():
    global _ir_instance
    if _ir_instance is None:
        import importlib.util
        _app_root = path.dirname(path.dirname(path.dirname(path.abspath(__file__))))
        spec = importlib.util.spec_from_file_location(
            'ir_controller',
            path.join(_app_root, 'viewer', 'ir_controller.py'),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _ir_instance = mod.IrController()
    return _ir_instance


class IrStatusViewV2(APIView):
    """GET /api/v2/ir/status — IR hardware availability."""

    @authorized
    def get(self, request):
        return Response(_get_ir().get_status())


class IrTestViewV2(APIView):
    """POST /api/v2/ir/test — Send a test IR power code."""

    @authorized
    def post(self, request):
        protocol = request.data.get('protocol', '')
        scancode = request.data.get('scancode', '')
        if not protocol or not scancode:
            return Response(
                {'error': 'protocol and scancode are required'},
                status=400,
            )
        ir = _get_ir()
        if not ir.get_status()['ir_available']:
            return Response(
                {'success': False, 'error': 'No TX-capable IR device found'},
                status=400,
            )
        sent = ir.send_power(protocol, scancode)
        return Response({'success': sent})


class ViewLogViewV2(APIView):
    """GET /api/v2/viewlog — playback history from viewlog.db."""

    @authorized
    def get(self, request):
        import sqlite3

        db_path = path.join(
            path.expanduser('~'), '.screenly', 'viewlog.db'
        )
        if not path.exists(db_path):
            return Response([])

        since = request.query_params.get('since')

        try:
            conn = sqlite3.connect(db_path, timeout=3)
            if since:
                rows = conn.execute(
                    'SELECT asset_id, asset_name, mimetype, started_at '
                    'FROM viewlog WHERE started_at > ? ORDER BY id ASC',
                    (since,)
                ).fetchall()
            else:
                rows = conn.execute(
                    'SELECT asset_id, asset_name, mimetype, started_at '
                    'FROM viewlog ORDER BY id ASC'
                ).fetchall()
            conn.close()
        except Exception:
            return Response([])

        entries = [
            {
                'asset_id': r[0],
                'asset_name': r[1],
                'mimetype': r[2],
                'started_at': r[3],
            }
            for r in rows
        ]
        return Response(entries)
