from django.db import models
from django.contrib.auth.models import User

class WordSet(models.Model):
    name = models.CharField(max_length=100)
    public = models.BooleanField(default=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="word_sets")

    def __str__(self):
        return self.name

class Word(models.Model):
    word_set = models.ForeignKey(WordSet, related_name="words", on_delete=models.CASCADE)
    pl = models.CharField(max_length=100)
    en = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.pl} - {self.en}"

class Quiz(models.Model):
    name = models.CharField(max_length=100)
    word_set = models.ForeignKey(WordSet, related_name="quizzes", on_delete=models.CASCADE)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quizzes")
    public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Question(models.Model):
    quiz = models.ForeignKey(Quiz, related_name="questions", on_delete=models.CASCADE)
    word = models.ForeignKey(Word, on_delete=models.CASCADE)
    option1 = models.CharField(max_length=100)
    option2 = models.CharField(max_length=100)
    option3 = models.CharField(max_length=100)
    option4 = models.CharField(max_length=100)
    correct_option = models.IntegerField()  # numer 1-4

    def __str__(self):
        return f"Question: {self.word.pl}"