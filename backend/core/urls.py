from django.urls import path
from .views import health
from .addresses import addresses, address_detail, activate_address, reverse_geocode

urlpatterns = [path("health/", health, name="health"),
    path('addresses/', addresses),
    path('addresses/<uuid:address_id>/', address_detail),
    path('addresses/<uuid:address_id>/activate/', activate_address),
    path('locations/reverse/', reverse_geocode),
]
