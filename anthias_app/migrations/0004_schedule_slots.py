"""Add ScheduleSlot and ScheduleSlotItem models for time-of-day scheduling."""

import anthias_app.models
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('anthias_app', '0003_viewlog'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduleSlot',
            fields=[
                (
                    'slot_id',
                    models.TextField(
                        default=anthias_app.models.generate_asset_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ('name', models.TextField(default='')),
                ('time_from', models.TimeField(default='00:00')),
                ('time_to', models.TimeField(default='23:59')),
                (
                    'days_of_week',
                    models.TextField(
                        default=anthias_app.models._default_all_days,
                    ),
                ),
                ('is_default', models.BooleanField(default=False)),
                ('sort_order', models.IntegerField(default=0)),
            ],
            options={
                'db_table': 'schedule_slots',
                'ordering': ['sort_order', 'time_from'],
            },
        ),
        migrations.CreateModel(
            name='ScheduleSlotItem',
            fields=[
                (
                    'item_id',
                    models.TextField(
                        default=anthias_app.models.generate_asset_id,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ('sort_order', models.IntegerField(default=0)),
                (
                    'duration_override',
                    models.BigIntegerField(
                        blank=True,
                        help_text='If set, overrides the asset duration for this slot.',
                        null=True,
                    ),
                ),
                (
                    'asset',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='slot_items',
                        to='anthias_app.asset',
                    ),
                ),
                (
                    'slot',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='items',
                        to='anthias_app.scheduleslot',
                    ),
                ),
            ],
            options={
                'db_table': 'schedule_slot_items',
                'ordering': ['sort_order'],
                'unique_together': {('slot', 'asset')},
            },
        ),
    ]
