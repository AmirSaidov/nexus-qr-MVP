from rest_framework import serializers

from .models import OccupancyHistory, Place, Room, User, ExitRequest


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email', 'is_staff', 'is_in_room', 'current_room', 'current_place', 'check_in_time', 'role']

    def get_name(self, obj):
        return getattr(obj, 'name', '') or obj.get_full_name() or obj.username


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'qr_code', 'exit_mode', 'exit_password']


class PlaceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    backend_status = serializers.CharField(source='status', read_only=True)
    user = UserSerializer(read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True, allow_null=True)

    class Meta:
        model = Place
        fields = ['id', 'number', 'status', 'backend_status', 'occupied_at', 'user', 'user_name']

    def get_status(self, obj):
        return {
            'free': 'available',
            'occupied': 'booked',
        }.get(obj.status, obj.status)


class RoomPlacesSerializer(serializers.ModelSerializer):
    places = PlaceSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'places']


class OccupancyHistorySerializer(serializers.ModelSerializer):
    place_id = serializers.IntegerField(source='place.id', read_only=True)
    place_number = serializers.IntegerField(source='place.number', read_only=True)
    room_id = serializers.IntegerField(source='place.room.id', read_only=True)
    room_name = serializers.CharField(source='place.room.name', read_only=True)
    user = UserSerializer(read_only=True)
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = OccupancyHistory
        fields = [
            'id',
            'place_id',
            'place_number',
            'room_id',
            'room_name',
            'user',
            'start_time',
            'end_time',
            'duration_minutes',
        ]

    def get_duration_minutes(self, obj):
        if not obj.end_time:
            return None
        if obj.start_time:
            return int((obj.end_time - obj.start_time).total_seconds() // 60)
        return obj.duration_minutes


class ExitRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExitRequest
        fields = ['id', 'user', 'room', 'status', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
