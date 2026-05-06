from datetime import datetime, time

from django.contrib.auth import authenticate
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.permissions import AllowAny, IsAuthenticated
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


class LeaveRoomView(APIView):
    """Leave current room without occupying a place (teachers/admins)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if not user.is_in_room and not user.current_room_id:
            return Response({"success": True, "message": "Вы уже не в кабинете"})

        # Close teacher/admin room entry record if any (best-effort)
        try:
            from .models import RoomEntryHistory
            if user.role in ['teacher', 'admin'] and user.current_room_id:
                entry = (
                    RoomEntryHistory.objects
                    .filter(user=user, room_id=user.current_room_id, left_at__isnull=True)
                    .order_by('-entered_at')
                    .first()
                )
                if entry:
                    entry.left_at = timezone.now()
                    entry.save(update_fields=['left_at'])
        except Exception:
            pass

        # If user occupies a place, reuse existing release flow
        if getattr(user, 'current_place_id', None):
            place, history, error = release_place(user.current_place_id)
            if error:
                return Response({"success": False, "message": error}, status=400)
            return Response({
                "success": True,
                "message": "Вы вышли из кабинета",
                "place": PlaceSerializer(place).data if place else None,
                "history": OccupancyHistorySerializer(history).data if history else None,
            })

        user.is_in_room = False
        user.current_room = None
        user.current_place = None
        user.check_in_time = None
        user.save()

        return Response({"success": True, "message": "Вы вышли из кабинета"})


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

        # Track only teacher/admin room enters (admin history)
        try:
            from .models import RoomEntryHistory
            if user.role in ['teacher', 'admin']:
                RoomEntryHistory.objects.create(user=user, room=room)
        except Exception:
            pass

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

        # Close teacher/admin room entry record if any (best-effort)
        try:
            from .models import RoomEntryHistory
            user = request.user
            if user.role in ['teacher', 'admin']:
                entry = (
                    RoomEntryHistory.objects
                    .filter(user=user, left_at__isnull=True)
                    .order_by('-entered_at')
                    .first()
                )
                if entry:
                    entry.left_at = timezone.now()
                    entry.save(update_fields=['left_at'])
        except Exception:
            pass

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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ"}, status=403)

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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ"}, status=403)

        from .models import RoomEntryHistory

        qs = RoomEntryHistory.objects.select_related('user', 'room').order_by('-entered_at')

        try:
            page = int(request.query_params.get('page', '1'))
        except ValueError:
            page = 1
        page = max(page, 1)
        page_size = 20
        start = (page - 1) * page_size
        end = start + page_size

        items = list(qs[start:end])
        has_next = qs.count() > end

        results = []
        for item in items:
            user = item.user
            room = item.room

            results.append({
                "id": item.id,
                "teacher_id": user.id if user else None,
                "teacher_name": getattr(user, "name", "") or getattr(user, "username", "") or "Teacher",
                "user_email": getattr(user, "email", "") or "Без email",
                "room_id": room.id if room else None,
                "room_name": room.name if room else "-",
                "entered_at": item.entered_at,
                "left_at": item.left_at,
            })

        return Response(data)

class AdminActiveBookingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ"}, status=403)

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

        req, created = ExitRequest.objects.get_or_create(
            user=user,
            room=user.current_room,
            status='pending'
        )
        return Response({"success": True, "message": "Запрос на выход отправлен"})





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
            "status": status
        })





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
            
        users = User.objects.filter(current_room=user.current_room, is_in_room=True).select_related('current_place').order_by('role', 'name')
        
        data = []
        for u in users:
            data.append({
                "id": u.id,
                "name": u.name or u.username,
                "role": u.role,
                "place_number": u.current_place.number if u.current_place else None,
                "place_id": u.current_place.id if u.current_place else None,
                "confirmation_status": u.current_place.confirmation_status if u.current_place else None,
                "check_in_time": u.check_in_time
            })
            
        return Response({"success": True, "users": data})


class ConfirmPlaceView(APIView):
    """Teacher confirms a student is physically present."""
    permission_classes = [IsAuthenticated]

    def post(self, request, place_id):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Response({"success": False, "message": "Место не найдено"}, status=404)

        if place.status != 'occupied':
            return Response({"success": False, "message": "Место не занято"}, status=400)

        place.confirmation_status = 'confirmed'
        place.save()

        from .models import AdminLog
        AdminLog.objects.create(
            action='confirmed',
            user=place.user,
            teacher=user,
            room=place.room,
            place=place,
        )
        return Response({"success": True, "message": "Присутствие подтверждено"})


class RemovePlaceView(APIView):
    """Teacher removes a student who is not physically present."""
    permission_classes = [IsAuthenticated]

    def post(self, request, place_id):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        try:
            place = Place.objects.get(id=place_id)
        except Place.DoesNotExist:
            return Response({"success": False, "message": "Место не найдено"}, status=404)

        if place.status != 'occupied':
            return Response({"success": False, "message": "Место не занято"}, status=400)

        from .models import AdminLog
        AdminLog.objects.create(
            action='rejected',
            user=place.user,
            teacher=user,
            room=place.room,
            place=place,
        )
        release_place(place.id)
        return Response({"success": True, "message": "Ученик удалён, место освобождено"})


class ConfirmAllView(APIView):
    """Confirm all pending students in a room."""
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        count = Place.objects.filter(
            room_id=room_id, status='occupied', confirmation_status='pending'
        ).update(confirmation_status='confirmed')

        return Response({"success": True, "message": f"Подтверждено: {count}", "count": count})


class RemoveUnconfirmedView(APIView):
    """Remove all unconfirmed (pending) students from a room."""
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        user = request.user
        if user.role not in ['teacher', 'admin']:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        places = Place.objects.filter(
            room_id=room_id, status='occupied', confirmation_status='pending'
        )
        count = places.count()
        for place in places:
            AdminLog.objects.create(
                action='rejected',
                user=place.user,
                teacher=user,
                room=place.room,
                place=place,
                details=f'Bulk remove unconfirmed'
            )
            release_place(place.id)

        return Response({"success": True, "message": f"Удалено: {count}", "count": count})


# ─── Admin Panel Views ───────────────────────────────────────────────

from .models import AdminLog
import re
from django.utils.text import slugify


def generate_room_qr_code(name: str) -> str:
    """
    Generate a human-friendly QR code key.
    Examples: "room-401", "room-101-2".
    """
    digits = re.findall(r"\d+", name or "")
    if digits:
        base = f"room-{digits[0]}"
    else:
        s = slugify(name or "", allow_unicode=False)
        base = f"room-{s}" if s else "room"

    candidate = base
    i = 2
    while Room.objects.filter(qr_code=candidate).exists():
        candidate = f"{base}-{i}"
        i += 1
    return candidate


class AdminDashboardView(APIView):
    """Dashboard statistics for the admin panel."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        from django.utils.timezone import now, make_aware
        from datetime import datetime, time as dt_time

        today_start = now().replace(hour=0, minute=0, second=0, microsecond=0)

        active_rooms = Room.objects.count()
        students_in_system = User.objects.filter(is_in_room=True).count()
        pending_count = Place.objects.filter(status='occupied', confirmation_status='pending').count()
        confirmed_count = Place.objects.filter(status='occupied', confirmation_status='confirmed').count()
        rejected_today = AdminLog.objects.filter(action='rejected', created_at__gte=today_start).count()

        return Response({
            "active_rooms": active_rooms,
            "students_in_system": students_in_system,
            "pending": pending_count,
            "confirmed": confirmed_count,
            "rejected_today": rejected_today,
        })


class AdminRoomsView(APIView):
    """CRUD for rooms in admin panel."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        rooms = Room.objects.all().order_by('id')
        data = []
        for room in rooms:
            places = room.places.all()
            data.append({
                "id": room.id,
                "name": room.name,
                "qr_code": room.qr_code,
                "places_count": places.count(),
                "created_at": room.created_at,
            })
        return Response(data)

    def post(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        name = request.data.get('name')
        if not name:
            return Response({"success": False, "message": "Название обязательно"}, status=400)

        qr_code = request.data.get('qr_code') or generate_room_qr_code(str(name))

        if Room.objects.filter(qr_code=qr_code).exists():
            return Response({"success": False, "message": "QR код уже существует"}, status=400)

        room = Room.objects.create(name=name, qr_code=qr_code)
        return Response({
            "success": True,
            "room": {
                "id": room.id,
                "name": room.name,
                "qr_code": room.qr_code,
                "places_count": 0,
                "created_at": room.created_at,
            }
        }, status=201)


class AdminRoomDetailView(APIView):
    """Update/delete a single room."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, room_id):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"success": False, "message": "Кабинет не найден"}, status=404)

        name = request.data.get('name')
        if name:
            room.name = name
            room.save()

        return Response({
            "success": True,
            "room": {
                "id": room.id,
                "name": room.name,
                "qr_code": room.qr_code,
                "places_count": room.places.count(),
                "created_at": room.created_at,
            }
        })

    def delete(self, request, room_id):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"success": False, "message": "Кабинет не найден"}, status=404)

        room_name = room.name
        room.delete()
        return Response({"success": True, "message": f"Кабинет '{room_name}' удалён"})


class AdminPlacesBulkUpdateView(APIView):
    """Bulk create/update/delete places for layout editor."""
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"success": False, "message": "Кабинет не найден"}, status=404)

        places_data = request.data.get('places', [])
        if not isinstance(places_data, list):
            return Response({"success": False, "message": "places должен быть массивом"}, status=400)

        # Get current place numbers for this room
        existing = {p.number: p for p in room.places.all()}
        incoming_numbers = set()
        created_places = []

        for p in places_data:
            number = p.get('number')
            x = p.get('x', 0)
            y = p.get('y', 0)
            if number is None:
                continue
            incoming_numbers.add(number)

            if number in existing:
                place = existing[number]
                place.x = x
                place.y = y
                place.save()
            else:
                created_places.append(Place.objects.create(room=room, number=number, x=x, y=y))

        # Delete places that are not in the incoming list (only if free)
        deleted_places = []
        for number, place in existing.items():
            if number not in incoming_numbers and place.status == 'free':
                deleted_places.append(place)
                place.delete()

        # Return updated places
        places = room.places.all().order_by('number')
        result = []
        for p in places:
            result.append({
                "id": p.id,
                "number": p.number,
                "x": p.x,
                "y": p.y,
                "status": p.status,
            })

        return Response({"success": True, "places": result})


class AdminRoomPlacesView(APIView):
    """Get all places for a room with x/y coordinates for layout editor."""
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return Response({"success": False, "message": "Кабинет не найден"}, status=404)

        places = room.places.all().order_by('number')
        data = []
        for p in places:
            data.append({
                "id": p.id,
                "number": p.number,
                "x": p.x,
                "y": p.y,
                "status": p.status,
                "user_name": (p.user.name or p.user.username) if p.user else None,
            })
        return Response(data)


class AdminLogsView(APIView):
    """View user confirmation/rejection logs with filters."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        logs = AdminLog.objects.select_related('user', 'teacher', 'room', 'place').filter(action__in=['confirmed', 'rejected'])

        # Filter by room
        room_id = request.query_params.get('room_id')
        if room_id:
            logs = logs.filter(room_id=room_id)

        # Filter by action
        action = request.query_params.get('action')
        if action in ['confirmed', 'rejected']:
            logs = logs.filter(action=action)

        # Filter by date
        date_str = request.query_params.get('date')
        if date_str:
            parsed = parse_date(date_str)
            if parsed:
                day_start = datetime.combine(parsed, time.min)
                day_end = datetime.combine(parsed, time.max)
                if timezone.is_naive(day_start):
                    day_start = timezone.make_aware(day_start)
                    day_end = timezone.make_aware(day_end)
                logs = logs.filter(created_at__gte=day_start, created_at__lte=day_end)

        logs = logs[:200]

        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "action": log.action,
                "user_name": (log.user.name or log.user.username) if log.user else None,
                "user_id": log.user_id,
                "teacher_name": (log.teacher.name or log.teacher.username) if log.teacher else None,
                "teacher_id": log.teacher_id,
                "room_name": log.room.name if log.room else None,
                "room_id": log.room_id,
                "place_number": log.place.number if log.place else None,
                "place_id": log.place_id,
                "details": log.details,
                "created_at": log.created_at,
            })
        return Response(data)


class AdminRejectedView(APIView):
    """View all rejected users."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff:
            return Response({"success": False, "message": "Доступ запрещен"}, status=403)

        logs = AdminLog.objects.filter(action='rejected').select_related('user', 'teacher', 'room', 'place').order_by('-created_at')[:100]

        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "user_name": (log.user.name or log.user.username) if log.user else "Unknown",
                "teacher_name": (log.teacher.name or log.teacher.username) if log.teacher else None,
                "room_name": log.room.name if log.room else None,
                "place_number": log.place.number if log.place else None,
                "created_at": log.created_at,
            })
        return Response(data)
