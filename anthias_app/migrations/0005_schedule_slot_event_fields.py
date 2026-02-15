"""Add event slot support: slot_type, start_date, end_date, no_loop fields."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anthias_app', '0004_schedule_slots'),
    ]

    operations = [
        migrations.AddField(
            model_name='scheduleslot',
            name='slot_type',
            field=models.CharField(
                choices=[
                    ('default', 'Default'),
                    ('time', 'Time'),
                    ('event', 'Event'),
                ],
                default='time',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='scheduleslot',
            name='start_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='scheduleslot',
            name='end_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='scheduleslot',
            name='no_loop',
            field=models.BooleanField(default=False),
        ),
    ]
