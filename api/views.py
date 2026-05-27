import csv
import json
import random
from django.db.models import Q
from django.shortcuts import render
from .models import WordSet, Word, Quiz, Question
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token


def app_home(request):
    return render(request, "api/index.html")


def serialize_word(word):
    return {
        "id": word.id,
        "pl": word.pl,
        "en": word.en,
    }


def serialize_word_set(word_set, include_words=False, user=None):
    data = {
        "id": word_set.id,
        "name": word_set.name,
        "public": word_set.public,
        "owner": word_set.owner.username,
        "is_owner": bool(user and word_set.owner_id == user.id),
    }
    if include_words:
        data["words"] = [serialize_word(word) for word in word_set.words.all()]
    return data


# Pobranie wszystkich zestawów (tylko publiczne + własne)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_sets(request):
    sets = (
        WordSet.objects
        .filter(Q(public=True) | Q(owner=request.user))
        .select_related("owner")
        .order_by("name")
        .distinct()
    )
    return Response([serialize_word_set(word_set, user=request.user) for word_set in sets])

# Pobranie jednego zestawu wraz ze słówkami
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_set(request, set_id):
    try:
        word_set = WordSet.objects.select_related("owner").prefetch_related("words").get(id=set_id)
        if not word_set.public and word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak dostępu do zestawu"}, status=403)

        return Response(serialize_word_set(word_set, include_words=True, user=request.user))
    except WordSet.DoesNotExist:
        return Response({"status": "error", "message": "Zestaw nie istnieje"}, status=404)

# Flashcards – lista słówek dla danego zestawu
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def flashcards(request, set_id):
    try:
        word_set = WordSet.objects.get(id=set_id)
        if not word_set.public and word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak dostępu do zestawu"}, status=403)
        return Response([serialize_word(word) for word in word_set.words.all()])
    except WordSet.DoesNotExist:
        return Response({"error": "Set not found"}, status=404)

# Dodawanie słówka do zestawu
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_word(request, set_id):
    try:
        pl = (request.data.get("pl") or "").strip()
        en = (request.data.get("en") or "").strip()
        word_set = WordSet.objects.get(id=set_id)
        if word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak uprawnień"}, status=403)
        if not pl or not en:
            return Response({"status": "error", "message": "Podaj słowo po polsku i po angielsku"}, status=400)

        word = Word.objects.create(word_set=word_set, pl=pl, en=en)
        return Response({"status": "ok", "word": serialize_word(word)}, status=201)
    except WordSet.DoesNotExist:
        return Response({"status": "error", "message": "Zestaw nie istnieje"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)

# Tworzenie quizu z zestawu
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_quiz(request, set_id):
    try:
        quiz_name = (request.data.get("name") or "").strip()
        if not quiz_name:
            return Response({"status": "error", "message": "Nazwa quizu wymagana"}, status=400)

        word_set = WordSet.objects.get(id=set_id)
        if word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak uprawnień"}, status=403)

        words = list(word_set.words.all())
        if len(words) < 4:
            return Response({"status": "error", "message": "Zestaw musi mieć co najmniej 4 słówka"}, status=400)

        quiz = Quiz.objects.create(
            name=quiz_name,
            word_set=word_set,
            owner=request.user,
            public=word_set.public,
        )

        for word in words:
            # wybieramy poprawną odpowiedź i 3 losowe inne
            correct_answer = word.en
            other_answers = random.sample([w.en for w in words if w.id != word.id], 3)
            options = other_answers + [correct_answer]
            random.shuffle(options)
            correct_index = options.index(correct_answer) + 1

            Question.objects.create(
                quiz=quiz,
                word=word,
                option1=options[0],
                option2=options[1],
                option3=options[2],
                option4=options[3],
                correct_option=correct_index
            )

        return Response({"status": "ok", "quiz_id": quiz.id})
    except WordSet.DoesNotExist:
        return Response({"status": "error", "message": "Zestaw nie istnieje"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)

# Pobranie quizu
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_quiz(request, quiz_id):
    try:
        quiz = Quiz.objects.prefetch_related("questions__word").select_related("word_set").get(id=quiz_id)
        if quiz.owner != request.user and not quiz.word_set.public:
            return Response({"status": "error", "message": "Brak dostępu"}, status=403)

        questions_list = []
        for q in quiz.questions.all():
            questions_list.append({
                "id": q.id,
                "pl": q.word.pl,
                "options": [q.option1, q.option2, q.option3, q.option4],
                "correct_option": q.correct_option
            })

        return Response({"quiz": {"id": quiz.id, "name": quiz.name}, "questions": questions_list})
    except Quiz.DoesNotExist:
        return Response({"status": "error", "message": "Quiz nie istnieje"}, status=404)

# Tworzenie nowego zestawu słówek
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_set(request):
    try:
        name = (request.data.get("name") or "").strip()
        is_public = request.data.get("public", True)
        starter_words = request.data.get("words", [])
        if isinstance(is_public, str):
            is_public = is_public.lower() in {"1", "true", "tak", "yes", "on"}

        if not name:
            return Response({"status": "error", "message": "Nazwa zestawu jest wymagana"}, status=400)

        if starter_words is None:
            starter_words = []
        if not isinstance(starter_words, list):
            return Response({"status": "error", "message": "Lista słówek ma niepoprawny format"}, status=400)

        normalized_words = []
        for item in starter_words:
            if not isinstance(item, dict):
                return Response({"status": "error", "message": "Niepoprawny format słówka"}, status=400)

            pl = (item.get("pl") or "").strip()
            en = (item.get("en") or "").strip()
            if not pl and not en:
                continue
            if not pl or not en:
                return Response(
                    {"status": "error", "message": "Każde rozpoczęte słówko musi mieć wersję polską i angielską"},
                    status=400,
                )

            normalized_words.append(Word(word_set=None, pl=pl, en=en))

        new_set = WordSet.objects.create(name=name, public=is_public, owner=request.user)
        if normalized_words:
            for word in normalized_words:
                word.word_set = new_set
            Word.objects.bulk_create(normalized_words)

        return Response({"status": "ok", "set": serialize_word_set(new_set, include_words=True, user=request.user)}, status=201)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)

# Usuwanie słówka z zestawu
@api_view(["DELETE", "POST"])
@permission_classes([IsAuthenticated])
def delete_word(request, word_id):
    try:
        word = Word.objects.get(id=word_id)
        if word.word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak uprawnień"}, status=403)

        word.delete()
        return Response({"status": "ok", "message": "Słówko usunięte"})
    except Word.DoesNotExist:
        return Response({"status": "error", "message": "Słówko nie istnieje"}, status=404)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_words(request, set_id):
    try:
        word_set = WordSet.objects.get(id=set_id)
        if word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak uprawnień do tego zestawu"}, status=403)

        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            return Response({"status": "error", "message": "Nie przesłano żadnego pliku"}, status=400)

        filename = uploaded_file.name.lower()
        words_to_create = []

        if filename.endswith(".csv"):
            rows = csv.reader(uploaded_file.read().decode("utf-8-sig").splitlines())
            for row in rows:
                if len(row) < 2:
                    continue

                pl = row[0].strip()
                en = row[1].strip()
                if not pl or not en:
                    continue
                if pl.lower() in {"pl", "polski"} and en.lower() in {"en", "angielski", "english"}:
                    continue

                words_to_create.append(Word(word_set=word_set, pl=pl, en=en))
        elif filename.endswith(".json"):
            payload = json.loads(uploaded_file.read().decode("utf-8-sig"))
            if not isinstance(payload, list):
                return Response({"status": "error", "message": "Plik JSON musi zawierać listę obiektów"}, status=400)

            for item in payload:
                if not isinstance(item, dict):
                    continue

                pl = (item.get("pl") or "").strip()
                en = (item.get("en") or "").strip()
                if pl and en:
                    words_to_create.append(Word(word_set=word_set, pl=pl, en=en))
        else:
            return Response({"status": "error", "message": "Obsługiwane formaty to tylko .csv i .json"}, status=400)

        if words_to_create:
            Word.objects.bulk_create(words_to_create)

        return Response(
            {"status": "ok", "message": f"Zaimportowano {len(words_to_create)} słówek."},
            status=201,
        )
    except WordSet.DoesNotExist:
        return Response({"status": "error", "message": "Zestaw nie istnieje"}, status=404)
    except json.JSONDecodeError:
        return Response({"status": "error", "message": "Plik JSON ma niepoprawny format"}, status=400)
    except UnicodeDecodeError:
        return Response({"status": "error", "message": "Nie udało się odczytać pliku. Użyj kodowania UTF-8."}, status=400)
    except Exception as e:
        return Response({"status": "error", "message": f"Błąd przetwarzania pliku: {str(e)}"}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_word_answer(request, word_id):
    try:
        user_answer = (request.data.get("answer") or "").strip().lower()
        if not user_answer:
            return Response({"status": "error", "message": "Brak odpowiedzi"}, status=400)

        word = Word.objects.select_related("word_set__owner").get(id=word_id)
        if not word.word_set.public and word.word_set.owner != request.user:
            return Response({"status": "error", "message": "Brak dostępu do słówka"}, status=403)

        correct_answer = word.en.strip().lower()
        is_correct = user_answer == correct_answer

        return Response({
            "status": "ok",
            "correct": is_correct,
            "correct_answer": word.en,
        })
    except Word.DoesNotExist:
        return Response({"status": "error", "message": "Słówko nie istnieje"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_quiz(request, quiz_id):
    try:
        quiz = Quiz.objects.prefetch_related("questions__word").select_related("word_set").get(id=quiz_id)
        if quiz.owner != request.user and not quiz.word_set.public:
            return Response({"status": "error", "message": "Brak dostępu do tego quizu"}, status=403)

        user_answers = request.data.get("answers", {})
        if not isinstance(user_answers, dict):
            return Response({"status": "error", "message": "Odpowiedzi muszą być obiektem mapującym pytania"}, status=400)

        results = []
        correct_count = 0
        questions = list(quiz.questions.all())

        for question in questions:
            raw_user_option = user_answers.get(str(question.id), user_answers.get(question.id))
            try:
                user_option = int(raw_user_option) if raw_user_option is not None else None
            except (TypeError, ValueError):
                user_option = None

            is_correct = user_option == question.correct_option
            if is_correct:
                correct_count += 1

            results.append({
                "question_id": question.id,
                "is_correct": is_correct,
                "correct_option": question.correct_option,
                "correct_answer": [question.option1, question.option2, question.option3, question.option4][question.correct_option - 1],
                "user_option": user_option,
            })

        total_questions = len(questions)
        score_percentage = round((correct_count / total_questions * 100), 2) if total_questions else 0

        return Response({
            "status": "ok",
            "correct_count": correct_count,
            "total_questions": total_questions,
            "score_percentage": score_percentage,
            "results": results,
        })
    except Quiz.DoesNotExist:
        return Response({"status": "error", "message": "Quiz nie istnieje"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)

# Logowanie
@api_view(['POST'])
@permission_classes([AllowAny]) # Każdy nawet niezalogowany musi mieć tu dostęp
def register_user(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Podaj login i hasło'}, status=400)
    
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Użytkownik o takim loginie już istnieje'}, status=400)
    
    # Tworzenie uzytkownika
    user = User.objects.create_user(username=username, password=password)
    # Generowanie tokenu
    token, _ = Token.objects.get_or_create(user=user)
    
    return Response({
        'token': token.key, 
        'username': user.username,
        'message': 'Konto zostało utworzone!'
    }, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password')

    # Django sprawdza czy hasło pasuje do loginu
    user = authenticate(username=username, password=password)

    if user is not None:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key, 
            'username': user.username,
            'message': 'Zalogowano pomyślnie!'
        }, status=200)
    else:
        return Response({'error': 'Błędny login lub hasło'}, status=400)
