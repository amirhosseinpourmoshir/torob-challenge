from django.urls import path
from . import panel

urlpatterns = [path('session/', panel.session), path('login/', panel.sign_in), path('logout/', panel.sign_out), path('settings/', panel.configuration), path('models/', panel.profiles), path('models/<uuid:profile_id>/', panel.profiles), path('models/<uuid:profile_id>/test/', panel.probe)]
