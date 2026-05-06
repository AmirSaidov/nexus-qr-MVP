from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("rooms", "0010_place_x_place_y_adminlog"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoomEntryHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entered_at", models.DateTimeField(auto_now_add=True)),
                ("left_at", models.DateTimeField(blank=True, null=True)),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entry_history", to="rooms.room")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="room_entries", to="rooms.user")),
            ],
            options={
                "verbose_name": "Room Entry",
                "verbose_name_plural": "Room Entries",
                "ordering": ["-entered_at"],
            },
        ),
    ]

