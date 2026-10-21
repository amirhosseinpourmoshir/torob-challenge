from django.urls import path
from . import map_views

urlpatterns = [
    path('map/', map_views.viewport, name='shop-map'),
    path('search/', map_views.search, name='shop-search'),
]
