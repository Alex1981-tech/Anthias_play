from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('anthias_app', '0005_schedule_slot_event_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='scheduleslotitem',
            name='volume',
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text="TV volume 0-100 via CEC. Null = don't change.",
            ),
        ),
        migrations.AddField(
            model_name='scheduleslotitem',
            name='mute',
            field=models.BooleanField(
                default=False,
                help_text='Mute TV audio via CEC.',
            ),
        ),
    ]
