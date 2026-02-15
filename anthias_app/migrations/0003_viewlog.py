from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('anthias_app', '0002_auto_20241015_1524'),
    ]

    operations = [
        migrations.CreateModel(
            name='ViewLog',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('asset_id', models.TextField()),
                ('asset_name', models.TextField(blank=True, default='')),
                ('mimetype', models.TextField(blank=True, default='')),
                ('started_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'db_table': 'viewlog',
                'ordering': ['-started_at'],
            },
        ),
    ]
