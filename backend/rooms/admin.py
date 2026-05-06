from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import User, Room, Place, ExitRequest
from .services import release_place


@admin.register(User)
class UserAdmin(ModelAdmin):
    list_display = ('username', 'name', 'role', 'is_in_room', 'current_room', 'created_at')
    list_filter = ('role', 'is_in_room')
    list_editable = ('role',)


@admin.action(description="Отпустить всех учеников из кабинета")
def release_all_students(modeladmin, request, queryset):
    for room in queryset:
        # Release all places
        places = room.places.filter(status='occupied')
        for place in places:
            release_place(place.id)
        # Clear is_in_room for all users in this room
        room.current_users.all().update(
            is_in_room=False,
            current_room=None,
            current_place=None,
            check_in_time=None,
        )


@admin.register(Room)
class RoomAdmin(ModelAdmin):
    list_display = ('name', 'exit_mode', 'qr_code', 'created_at')
    actions = [release_all_students]


@admin.register(Place)
class PlaceAdmin(ModelAdmin):
    list_display = ('number', 'room', 'status', 'user')
    list_filter = ('room', 'status')
    ordering = ('room', 'number')


@admin.action(description="Разрешить выход")
def approve_exit(modeladmin, request, queryset):
    for req in queryset.filter(status='pending'):
        req.status = 'approved'
        req.save()
        if req.user.current_place:
            release_place(req.user.current_place.id)


@admin.action(description="Отклонить выход")
def reject_exit(modeladmin, request, queryset):
    queryset.filter(status='pending').update(status='rejected')


@admin.register(ExitRequest)
class ExitRequestAdmin(ModelAdmin):
    list_display = ('user', 'room', 'status', 'created_at')
    list_filter = ('status', 'room')
    actions = [approve_exit, reject_exit]