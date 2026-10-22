from django.urls import path
from . import views, admin_views
from . import library_views

urlpatterns = [path('conversations/<uuid:conversation_id>/', views.clear_conversation)]
urlpatterns += [path('saved-products/', library_views.saved_products), path('products/<str:product_id>/', library_views.product_sheet)]

urlpatterns += [path('conversations/', views.conversations), path('conversations/<uuid:conversation_id>/turns/', views.create_turn), path('conversations/<uuid:conversation_id>/shops/<str:shop_id>/', views.conversation_shop), path('turns/<uuid:turn_id>/', views.turn_status), path('knowledge/', admin_views.knowledge)]
