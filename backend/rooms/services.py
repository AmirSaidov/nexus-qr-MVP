from django.db import transaction
from django.utils import timezone

from .models import OccupancyHistory, Place, Room, User


def release_place(place_id):
    with transaction.atomic():
        try:
            place = Place.objects.select_for_update().get(id=place_id)
        except Place.DoesNotExist:
            return None, None, "Place with this ID was not found"

        if place.status == 'free':
            return None, None, "Place is already free"

        history = None
        if place.user:
            user = place.user
            history = OccupancyHistory.objects.filter(
                user=user,
                place=place,
                end_time__isnull=True
            ).last()
            
            if history:
                history.end_time = timezone.now()
                history.save()

            # Clear user's active status
            user.is_in_room = False
            user.current_room = None
            user.current_place = None
            user.check_in_time = None
            user.save()

        place.user = None
        place.status = 'free'
        place.occupied_at = None
        place.save()

        return place, history, None


def occupy_specific_place(user_id, place_id):
    with transaction.atomic():
        try:
            user = User.objects.get(id=user_id)
            place = Place.objects.select_for_update().get(id=place_id)
        except (User.DoesNotExist, Place.DoesNotExist):
            return None, "User or place was not found"

        if place.status == 'occupied':
            return None, "Place is already occupied"

        if Place.objects.filter(user=user, status='occupied').exists():
            return None, "User already occupies another place"

        place.user = user
        place.status = 'occupied'
        place.occupied_at = timezone.now()
        place.save()

        user.is_in_room = True
        user.current_room = place.room
        user.current_place = place
        user.check_in_time = place.occupied_at
        user.save()

        OccupancyHistory.objects.create(
            user=user,
            place=place,
            start_time=place.occupied_at,
        )

        return place, None


def occupy_place_in_room(user_id, qr_code):
    try:
        if not User.objects.filter(id=user_id).exists():
            return None, f"User with ID {user_id} was not found"

        try:
            room = Room.objects.get(qr_code=qr_code)
        except Room.DoesNotExist:
            return None, "Room was not found"

        existing_place = Place.objects.filter(room=room, user_id=user_id).first()
        if existing_place:
            return existing_place, None

        with transaction.atomic():
            place = (
                Place.objects.select_for_update()
                .filter(room=room, user__isnull=True, status='free')
                .order_by('number')
                .first()
            )

            if not place:
                return None, "No free places available"

            place.user_id = user_id
            place.status = 'occupied'
            place.occupied_at = timezone.now()
            place.save()

            user = User.objects.get(id=user_id)
            user.is_in_room = True
            user.current_room = room
            user.current_place = place
            user.check_in_time = place.occupied_at
            user.save()

            OccupancyHistory.objects.create(
                user_id=user_id,
                place=place,
                start_time=place.occupied_at,
            )

            return place, None

    except Exception as exc:
        return None, f"Server error: {exc}"
