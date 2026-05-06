from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Room, Place


@receiver(post_save, sender=Room)
def create_places(sender, instance, created, **kwargs):
    if created:
        # By default, new rooms start with 0 places.
        # Set CREATE_DEFAULT_PLACES=True to restore old behavior.
        if not getattr(settings, "CREATE_DEFAULT_PLACES", False):
            return
        for i in range(1, 13):
            Place.objects.create(room=instance, number=i)

