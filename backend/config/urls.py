from django.contrib import admin
from django.urls import include, path

urlpatterns = [path("admin/", admin.site.urls), path("api/", include("core.urls")), path("api/shops/", include("catalog.urls")), path('api/panel/', include('core.panel_urls')), path('api/agent/', include('agent.urls'))]
