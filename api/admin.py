from django.contrib import admin
from .models import WordSet, Word,Quiz, Question, UserWordProgress

admin.site.register(WordSet)
admin.site.register(Word)
admin.site.register(Quiz)
admin.site.register(Question)
admin.site.register(UserWordProgress)