import logging
from django.http import JsonResponse
from django.urls import path

log = logging.getLogger("debugger")


def index(request):
    log.info("home page hit")
    return JsonResponse({"status": "ok", "framework": "django"})


def test_view(request):
    id = request.GET.get("id", "")
    log.info("test endpoint id=%s", id)
    if request.GET.get("error") == "true":
        log.error("test error triggered id=%s", id)
        return JsonResponse({"error": "test error", "id": id}, status=500)
    return JsonResponse({"ok": True, "id": id})


def users_view(request):
    log.info("fetching users")
    return JsonResponse({"users": ["alice", "bob", "charlie"]})


urlpatterns = [
    path("", index),
    path("api/test", test_view),
    path("api/users", users_view),
]
