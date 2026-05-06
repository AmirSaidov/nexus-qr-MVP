from datetime import datetime, time

from django.contrib.auth import authenticate
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OccupancyHistory, Place, Room, User
from .serializers import OccupancyHistorySerializer, PlaceSerializer, RoomSerializer, UserSerializer
from .services import occupy_place_in_room, occupy_specific_place, release_place


def parse_history_filter(value, param_name):
    parsed = parse_datetime(value)
    if parsed is None:
        parsed_date = parse_date(value)
        if parsed_date is None:
            return None, f"Invalid '{param_name}' format. Use ISO datetime or YYYY-MM-DD."
        parsed = datetime.combine(parsed_date, time.max if param_name == 'to' else time.min)

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed, None


def apply_history_filters(queryset, query_params):
    from_value = query_params.get('from')
    to_value = query_params.get('to')

    if from_value:
        parsed_from, error = parse_history_filter(from_value, 'from')
        if error:
            return None, error
        queryset = queryset.filter(start_time__gte=parsed_from)

    if to_value:
        parsed_to, error = parse_history_filter(to_value, 'to')
        if error:
            return None, error
        queryset = queryset.filter(start_time__lte=parsed_to)

    return queryset, None


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')
        email = request.data.get('email', '')
        name = request.data.get('name', '')

        if not username or not password:
            return Response({"success": False, "message": "Email/Username and password are required"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"success": False, "message": "User already exists"}, status=400)

        User.objects.create_user(username=username, password=password, email=email, name=name)
        return Response({"success": True, "message": "User created"}, status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)

        if not user:
            return Response({"success": False, "message": "Invalid credentials"}, status=401)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        })


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'all')
        stats = (
            OccupancyHistory.objects.values('user__username', 'user__name')
            .annotate(total_time=Sum('duration_minutes'))
            .order_by('-total_time')[:10]
        )

        return Response({
            "period": period,
            "leaders": stats,
        })


class RoomListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rooms = Room.objects.all().order_by('id')
        return Response(RoomSerializer(rooms, many=True).data)


class RoomPlacesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"message": "Room was not found"}, status=404)

        places = room.places.select_related('user').order_by('number')
        return Response(PlaceSerializer(places, many=True).data)


class EnterRoomView(APIView):
    """QR scan → check user into a room. Sets is_in_room=True."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        qr_code = request.data.get('qr_code')
        if not qr_code:
            return Response({"success": False, "message": "qr_code is required"}, status=400)

        try:
            room = Room.objects.get(qr_code=qr_code)
        except Room.DoesNotExist:
            return Response({"success": False, "message": "Кабинет не найден. Проверьте QR-код"}, status=404)

        user = request.user
        user.is_in_room = True
        user.current_room = room
        user.check_in_time = timezone.now()
        user.save()

        return Response({
            "success": True,
            "message": f"Вы вошли в {room.name}",
            "room": RoomSerializer(room).data,
        })


class OccupySpecificPlaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, place_id):
        user = request.user
        # Must be checked into a room first
        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "message": "Сначала войдите в кабинет через QR-код"}, status=403)

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Response({"success": False, "message": "Место не найдено"}, status=404)

        # Must book within current room
        if place.room_id != user.current_room_id:
            return Response({"success": False, "message": "Это место находится в другом кабинете"}, status=403)

        place_obj, error = occupy_specific_place(user.id, place_id)
        if error:
            return Response({"success": False, "message": error}, status=400)

        return Response({"success": True, "place": PlaceSerializer(place_obj).data})


class LeavePlaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, place_id):
        place, history, error = release_place(place_id)
        if error:
            return Response({"success": False, "message": error}, status=400)

        return Response({
            "success": True,
            "message": "Place released successfully",
            "place": PlaceSerializer(place).data,
            "history": OccupancyHistorySerializer(history).data if history else None,
        })


class RoomHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        if not Room.objects.filter(id=room_id).exists():
            return Response({"message": "Room was not found"}, status=404)

        history = (
            OccupancyHistory.objects.filter(place__room_id=room_id)
            .select_related('user', 'place', 'place__room')
            .order_by('-start_time')
        )
        history, error = apply_history_filters(history, request.query_params)
        if error:
            return Response({"success": False, "message": error}, status=400)
        return Response(OccupancyHistorySerializer(history, many=True).data)


class PlaceHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, place_id):
        if not Place.objects.filter(id=place_id).exists():
            return Response({"message": "Place was not found"}, status=404)

        history = (
            OccupancyHistory.objects.filter(place_id=place_id)
            .select_related('user', 'place', 'place__room')
            .order_by('-start_time')
        )
        history, error = apply_history_filters(history, request.query_params)
        if error:
            return Response({"success": False, "message": error}, status=400)
        return Response(OccupancyHistorySerializer(history, many=True).data)

class UserHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = (
            OccupancyHistory.objects.filter(user=request.user)
            .select_related('user', 'place', 'place__room')
            .order_by('-start_time')
        )
        history, error = apply_history_filters(history, request.query_params)
        if error:
            return Response({"success": False, "message": error}, status=400)
        return Response(OccupancyHistorySerializer(history, many=True).data)

    def delete(self, request):
        OccupancyHistory.objects.filter(user=request.user).delete()
        return Response({"success": True, "message": "History cleared"})


class GlobalHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = (
            OccupancyHistory.objects.all()
            .select_related('user', 'place', 'place__room')
            .order_by('-start_time')[:50]
        )
        return Response(OccupancyHistorySerializer(history, many=True).data)

class AdminUserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.db.models import Prefetch
        users = User.objects.prefetch_related(
            Prefetch('place_set', queryset=Place.objects.filter(status='occupied'), to_attr='active_places')
        )
        
        data = []
        for user in users:
            place = user.active_places[0] if user.active_places else None
            data.append({
                "id": user.id,
                "name": getattr(user, 'name', '') or user.get_full_name() or user.username,
                "email": user.email,
                "is_staff": user.is_staff,
                "place": {
                    "id": place.id,
                    "number": place.number,
                    "room_name": place.room.name,
                    "occupied_at": place.occupied_at,
                } if place else None
            })
        return Response(data)

class AdminHistoryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        history = (
            OccupancyHistory.objects.all()
            .select_related('user', 'place', 'place__room')
            .order_by('-start_time')
        )

        history, error = apply_history_filters(history, request.query_params)
        if error:
            return Response({"success": False, "message": error}, status=400)

        data = []
        for item in history:
            user = item.user
            place = item.place
            room = place.room if place else None

            data.append({
                "id": item.id,
                "user_id": user.id if user else None,
                "user_name": getattr(user, "name", "") or getattr(user, "username", "") or "User",
                "user_email": getattr(user, "email", "") or "Без email",
                "room_id": room.id if room else None,
                "room_name": room.name if room else "-",
                "place_id": place.id if place else None,
                "place_number": place.number if place else "-",
                "start_time": item.start_time,
                "end_time": item.end_time,
                "status": "active" if item.end_time is None else "completed",
            })

        return Response(data)

class AdminActiveBookingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        active = (
            OccupancyHistory.objects.filter(end_time__isnull=True)
            .select_related('user', 'place', 'place__room')
            .order_by('-start_time')
        )

        data = []
        for item in active:
            user = item.user
            place = item.place
            room = place.room if place else None

            data.append({
                "id": item.id,
                "user_id": user.id if user else None,
                "user_name": getattr(user, "name", "") or getattr(user, "username", "") or "User",
                "user_email": getattr(user, "email", "") or "Без email",
                "room_id": room.id if room else None,
                "room_name": room.name if room else "-",
                "place_id": place.id if place else None,
                "place_number": place.number if place else "-",
                "start_time": item.start_time,
                "end_time": item.end_time,
                "status": "active",
            })

        return Response(data)


from .models import ExitRequest
from .serializers import ExitRequestSerializer

class ExitRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "message": "Вы не находитесь в кабинете"}, status=400)
        
        if user.current_room.exit_mode != 'teacher':
            return Response({"success": False, "message": "В этом кабинете выход по паролю"}, status=400)

        req, created = ExitRequest.objects.get_or_create(
            user=user,
            room=user.current_room,
            status='pending'
        )
        return Response({"success": True, "message": "Запрос на выход отправлен"})


class ExitConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get('password')

        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "message": "Вы не находитесь в кабинете"}, status=400)
        
        if user.current_room.exit_mode == 'password':
            if user.current_room.exit_password and user.current_room.exit_password != password:
                return Response({"success": False, "message": "Неверный пароль"}, status=400)
        elif user.current_room.exit_mode == 'teacher':
            return Response({"success": False, "message": "В этом кабинете выход только по разрешению преподавателя"}, status=400)

        place = user.current_place
        if place:
            # release_place also clears user status fields
            release_place(place.id)
        else:
            # If user entered room but didn't pick a place, still clear their status
            user.is_in_room = False
            user.current_room = None
            user.current_place = None
            user.check_in_time = None
            user.save()
            
        return Response({"success": True, "message": "Выход подтвержден"})


class ExitStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "status": "not_in_room"})
        
        req = ExitRequest.objects.filter(user=user, room=user.current_room).order_by('-created_at').first()
        
        status = "no_request"
        if req:
            status = req.status
            
        return Response({
            "success": True,
            "status": status,
            "exit_mode": user.current_room.exit_mode
        })


class RoomConfigView(APIView):
    """Allow teachers to configure their current room."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Только преподаватели могут менять настройки кабинета"}, status=403)
        
        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "message": "Вы не находитесь в кабинете"}, status=400)
        
        room = user.current_room
        exit_mode = request.data.get('exit_mode')
        exit_password = request.data.get('exit_password')
        
        if exit_mode:
            room.exit_mode = exit_mode
        if exit_password is not None:
            room.exit_password = exit_password
            
        room.save()
        return Response({"success": True, "message": "Настройки сохранены", "room": RoomSerializer(room).data})


class TeacherRequestsView(APIView):
    """List pending exit requests for the teacher's current room."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)
        
        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "message": "Вы не находитесь в кабинете"}, status=400)
            
        requests = ExitRequest.objects.filter(room=user.current_room, status='pending').order_by('created_at')
        
        data = []
        for r in requests:
            data.append({
                "id": r.id,
                "user_name": r.user.name or r.user.username,
                "created_at": r.created_at,
                "place_number": r.user.current_place.number if r.user.current_place else None
            })
            
        return Response({"success": True, "requests": data})


class HandleExitRequestView(APIView):
    """Approve or reject a student's exit request."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)
            
        action = request.data.get('action') # 'approve' or 'reject'
        
        try:
            exit_req = ExitRequest.objects.get(id=request_id)
        except ExitRequest.DoesNotExist:
            return Response({"success": False, "message": "Запрос не найден"}, status=404)
            
        if action == 'approve':
            exit_req.status = 'approved'
            exit_req.save()
            
            # Also release the place for the student
            student = exit_req.user
            place = student.current_place
            if place:
                release_place(place.id)
            else:
                student.is_in_room = False
                student.current_room = None
                student.current_place = None
                student.check_in_time = None
                student.save()
                
            return Response({"success": True, "message": "Выход разрешен"})
        
        elif action == 'reject':
            exit_req.status = 'rejected'
            exit_req.save()
            return Response({"success": True, "message": "Запрос отклонен"})
            
        return Response({"success": False, "message": "Неверное действие"}, status=400)


class RoomAttendanceView(APIView):
    """List all users currently in the same room as the teacher."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)
            
        if not user.is_in_room or not user.current_room:
            return Response({"success": False, "message": "Вы не находитесь в кабинете"}, status=400)
            
        users = User.objects.filter(current_room=user.current_room, is_in_room=True).order_by('role', 'name')
        
        data = []
        for u in users:
            data.append({
                "id": u.id,
                "name": u.name or u.username,
                "role": u.role,
                "place_number": u.current_place.number if u.current_place else None,
                "check_in_time": u.check_in_time
            })
            
        return Response({"success": True, "users": data})