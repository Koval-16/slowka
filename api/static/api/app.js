const state = {
    token: localStorage.getItem("vocabapp_token") || "",
    username: localStorage.getItem("vocabapp_username") || "",
    sets: [],
    selectedSetId: null,
    selectedSet: null,
    flashcards: [],
    flashcardIndex: 0,
    flashcardRevealed: false,
    typingIndex: 0,
    quiz: null,
    quizAnswers: {},
    quizResult: null,
};

const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const setForm = document.querySelector("#set-form");
const addWordForm = document.querySelector("#add-word-form");
const quizForm = document.querySelector("#quiz-form");
const authFeedback = document.querySelector("#auth-feedback");
const setFeedback = document.querySelector("#set-feedback");
const addWordFeedback = document.querySelector("#add-word-feedback");
const importFeedback = document.querySelector("#import-feedback");
const typingFeedback = document.querySelector("#typing-feedback");
const quizFeedback = document.querySelector("#quiz-feedback");
const heroAuthStatus = document.querySelector("#hero-auth-status");
const guestAuth = document.querySelector("#guest-auth");
const accountSummary = document.querySelector("#account-summary");
const currentUser = document.querySelector("#current-user");
const setCount = document.querySelector("#set-count");
const activeSetName = document.querySelector("#active-set-name");
const nextStepTitle = document.querySelector("#next-step-title");
const nextStepCopy = document.querySelector("#next-step-copy");
const logoutButton = document.querySelector("#logout-button");
const createSetGate = document.querySelector("#create-set-gate");
const addWordGate = document.querySelector("#add-word-gate");
const importGate = document.querySelector("#import-gate");
const quizGate = document.querySelector("#quiz-gate");
const studyEmpty = document.querySelector("#study-empty");
const studyContent = document.querySelector("#study-content");
const selectedSetTitle = document.querySelector("#selected-set-title");
const selectedSetBadge = document.querySelector("#selected-set-badge");
const statWordCount = document.querySelector("#stat-word-count");
const statFlashcardCount = document.querySelector("#stat-flashcard-count");
const statQuizReady = document.querySelector("#stat-quiz-ready");
const quizReadyCopy = document.querySelector("#quiz-ready-copy");
const setsList = document.querySelector("#sets-list");
const refreshSetsButton = document.querySelector("#refresh-sets");
const wordRows = document.querySelector("#word-rows");
const wordRowTemplate = document.querySelector("#word-row-template");
const addWordRowButton = document.querySelector("#add-word-row");
const wordsTableBody = document.querySelector("#words-table-body");
const addWordContext = document.querySelector("#add-word-context");
const importForm = document.querySelector("#import-form");
const importContext = document.querySelector("#import-context");
const flashcardsEmpty = document.querySelector("#flashcards-empty");
const flashcardsContent = document.querySelector("#flashcards-content");
const flashcardCard = document.querySelector("#flashcard-card");
const flashcardSideLabel = document.querySelector("#flashcard-side-label");
const flashcardValue = document.querySelector("#flashcard-value");
const flashcardSubtitle = document.querySelector("#flashcard-subtitle");
const flashcardProgress = document.querySelector("#flashcard-progress");
const prevFlashcardButton = document.querySelector("#prev-flashcard");
const nextFlashcardButton = document.querySelector("#next-flashcard");
const flipFlashcardButton = document.querySelector("#flip-flashcard");
const typingEmpty = document.querySelector("#typing-empty");
const typingForm = document.querySelector("#typing-form");
const typingContext = document.querySelector("#typing-context");
const nextTypingWordButton = document.querySelector("#next-typing-word");
const quizBuilder = document.querySelector("#quiz-builder");
const quizRender = document.querySelector("#quiz-render");
const tabButtons = document.querySelectorAll("[data-tab-target]");
const scrollButtons = document.querySelectorAll("[data-scroll-target]");

function setFeedbackState(element, message = "", kind = "") {
    element.textContent = message;
    element.classList.remove("is-success", "is-error");
    if (kind) {
        element.classList.add(kind === "success" ? "is-success" : "is-error");
    }
}

async function apiFetch(url, options = {}, requiresAuth = false) {
    const headers = new Headers(options.headers || {});
    const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
    const isFormData = hasBody && options.body instanceof FormData;

    if (hasBody && !isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    if (requiresAuth) {
        if (!state.token) {
            throw new Error("Ta akcja wymaga zalogowania.");
        }
        headers.set("Authorization", `Token ${state.token}`);
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && requiresAuth) {
            clearAuth(true);
        }
        throw new Error(data.error || data.message || "Wystąpił błąd podczas komunikacji z API.");
    }

    return data;
}

function isOwnSet(wordSet) {
    return Boolean(wordSet) && (wordSet.is_owner || wordSet.owner === state.username);
}

function setAuth(data) {
    state.token = data.token;
    state.username = data.username;
    localStorage.setItem("vocabapp_token", data.token);
    localStorage.setItem("vocabapp_username", data.username);
    renderAuthState();
}

function clearAuth(silent = false) {
    state.token = "";
    state.username = "";
    state.sets = [];
    state.selectedSetId = null;
    state.selectedSet = null;
    state.flashcards = [];
    state.flashcardIndex = 0;
    state.flashcardRevealed = false;
    state.typingIndex = 0;
    state.quiz = null;
    state.quizAnswers = {};
    state.quizResult = null;
    localStorage.removeItem("vocabapp_token");
    localStorage.removeItem("vocabapp_username");
    renderAuthState();
    if (!silent) {
        setFeedbackState(authFeedback, "Wylogowano z aplikacji.", "success");
    }
}

function createWordRow(values = {}) {
    const fragment = wordRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".word-row");
    row.querySelector('input[name="pl"]').value = values.pl || "";
    row.querySelector('input[name="en"]').value = values.en || "";
    row.querySelector(".remove-row-button").addEventListener("click", () => {
        row.remove();
        if (!wordRows.children.length) {
            createWordRow();
        }
    });
    wordRows.appendChild(fragment);
}

function resetWordRows() {
    wordRows.innerHTML = "";
    createWordRow();
    createWordRow();
    createWordRow();
}

function collectWordsFromBuilder() {
    const words = [];
    const rows = wordRows.querySelectorAll(".word-row");

    for (const row of rows) {
        const pl = row.querySelector('input[name="pl"]').value.trim();
        const en = row.querySelector('input[name="en"]').value.trim();

        if (!pl && !en) {
            continue;
        }

        if (!pl || !en) {
            throw new Error("Każdy rozpoczęty wiersz słówka musi mieć wersję PL i EN.");
        }

        words.push({ pl, en });
    }

    return words;
}

function createBadge(publicState) {
    const badge = document.createElement("span");
    badge.className = `inline-badge ${publicState ? "public" : "private"}`;
    badge.textContent = publicState ? "Zestaw publiczny" : "Zestaw prywatny";
    return badge;
}

function updateSummary() {
    currentUser.textContent = state.username || "-";
    setCount.textContent = state.sets.filter((item) => item.owner === state.username).length.toString();
    activeSetName.textContent = state.selectedSet ? state.selectedSet.name : "Brak";

    if (!state.token) {
        nextStepTitle.textContent = "Załóż konto lub zaloguj się";
        nextStepCopy.textContent = "Po zalogowaniu zobaczysz swoje zestawy, fiszki i quizy w jednym miejscu.";
        return;
    }

    if (!state.selectedSet) {
        nextStepTitle.textContent = "Wybierz zestaw";
        nextStepCopy.textContent = "Po lewej stronie znajdziesz listę dostępnych zestawów gotowych do nauki.";
        return;
    }

    if (state.selectedSet.words.length < 4) {
        const missing = 4 - state.selectedSet.words.length;
        nextStepTitle.textContent = "Dodaj więcej słówek";
        nextStepCopy.textContent = `Do wygenerowania quizu brakuje jeszcze ${missing} ${missing === 1 ? "słówka" : "słówek"}.`;
        return;
    }

    nextStepTitle.textContent = "Możesz rozwiązać quiz";
    nextStepCopy.textContent = "Wybrany zestaw ma już dość materiału, żeby od razu sprawdzić postępy.";
}

function renderAuthState() {
    const isLoggedIn = Boolean(state.token);
    heroAuthStatus.textContent = isLoggedIn ? "Zalogowano" : "Gość";
    heroAuthStatus.classList.toggle("neutral", !isLoggedIn);
    guestAuth.classList.toggle("is-hidden", isLoggedIn);
    accountSummary.classList.toggle("is-hidden", !isLoggedIn);
    createSetGate.classList.toggle("is-hidden", isLoggedIn);
    setForm.classList.toggle("is-hidden", !isLoggedIn);

    if (isLoggedIn) {
        loadSets();
    } else {
        setsList.className = "sets-list empty-state";
        setsList.textContent = "Zaloguj się, żeby pobrać zestawy z API.";
        renderSelectedSet();
        renderFlashcards();
        renderTypingMode();
        renderQuiz();
    }

    updateSummary();
}

function renderSetList() {
    if (!state.token) {
        setsList.className = "sets-list empty-state";
        setsList.textContent = "Zaloguj się, żeby pobrać zestawy z API.";
        return;
    }

    if (!state.sets.length) {
        setsList.className = "sets-list empty-state";
        setsList.textContent = "Nie ma jeszcze żadnych dostępnych zestawów.";
        return;
    }

    setsList.className = "sets-list";
    setsList.innerHTML = "";

    const note = document.createElement("div");
    note.className = "summary-banner";
    note.textContent = `Masz ${state.sets.length} zestaw${state.sets.length === 1 ? "" : state.sets.length < 5 ? "y" : "ów"} gotow${state.sets.length === 1 ? "y" : "ych"} do nauki.`;
    setsList.appendChild(note);

    state.sets.forEach((wordSet) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `set-card ${wordSet.id === state.selectedSetId ? "is-selected" : ""}`;

        const title = document.createElement("strong");
        title.textContent = wordSet.name;

        const meta = document.createElement("div");
        meta.className = "set-card-meta";
        meta.textContent = `${wordSet.owner === state.username ? "Twój zestaw" : `Właściciel: ${wordSet.owner}`} • ${wordSet.public ? "Publiczny" : "Prywatny"}`;

        button.append(title, meta);
        button.addEventListener("click", () => {
            selectSet(wordSet.id);
        });
        setsList.appendChild(button);
    });
}

function renderWordTable() {
    wordsTableBody.innerHTML = "";

    if (!state.selectedSet || !state.selectedSet.words.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.className = "table-empty";
        cell.textContent = "Ten zestaw nie ma jeszcze żadnych słówek.";
        row.appendChild(cell);
        wordsTableBody.appendChild(row);
        return;
    }

    state.selectedSet.words.forEach((word) => {
        const row = document.createElement("tr");

        const plCell = document.createElement("td");
        plCell.textContent = word.pl;

        const enCell = document.createElement("td");
        enCell.textContent = word.en;

        const actionCell = document.createElement("td");
        if (isOwnSet(state.selectedSet)) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "table-action danger";
            button.textContent = "Usuń";
            button.addEventListener("click", () => {
                deleteWord(word.id);
            });
            actionCell.appendChild(button);
        } else {
            actionCell.textContent = "Tylko podgląd";
        }

        row.append(plCell, enCell, actionCell);
        wordsTableBody.appendChild(row);
    });
}

function renderSelectedSet() {
    if (!state.selectedSet) {
        studyEmpty.classList.remove("is-hidden");
        studyContent.classList.add("is-hidden");
        selectedSetTitle.textContent = "-";
        selectedSetBadge.textContent = "Brak zestawu";
        selectedSetBadge.classList.add("neutral");
        addWordGate.classList.remove("is-hidden");
        addWordGate.textContent = "Wybierz własny zestaw, aby dodać do niego kolejne słówka.";
        addWordForm.classList.add("is-hidden");
        addWordContext.textContent = "";
        importGate.classList.remove("is-hidden");
        importGate.textContent = "Wybierz własny zestaw, aby zaimportować do niego większą paczkę słówek z pliku.";
        importForm.classList.add("is-hidden");
        importContext.textContent = "";
        return;
    }

    studyEmpty.classList.add("is-hidden");
    studyContent.classList.remove("is-hidden");
    selectedSetTitle.textContent = state.selectedSet.name;
    selectedSetBadge.textContent = state.selectedSet.public ? "Zestaw publiczny" : "Zestaw prywatny";
    selectedSetBadge.classList.toggle("neutral", false);
    statWordCount.textContent = state.selectedSet.words.length.toString();
    statFlashcardCount.textContent = state.selectedSet.words.length.toString();

    if (state.selectedSet.words.length >= 4) {
        statQuizReady.textContent = "Gotowy";
        quizReadyCopy.textContent = "Sprawdź, czy zestaw ma już dość słówek do testu.";
    } else {
        statQuizReady.textContent = "W przygotowaniu";
        quizReadyCopy.textContent = "Dodaj co najmniej 4 słówka, aby uruchomić quiz.";
    }

    if (isOwnSet(state.selectedSet)) {
        addWordGate.classList.add("is-hidden");
        addWordForm.classList.remove("is-hidden");
        addWordContext.textContent = `Aktywny zestaw: ${state.selectedSet.name}`;
        importGate.classList.add("is-hidden");
        importForm.classList.remove("is-hidden");
        importContext.textContent = `Aktywny zestaw: ${state.selectedSet.name}. Możesz wczytać plik w formacie CSV lub JSON.`;
    } else {
        addWordGate.classList.remove("is-hidden");
        addWordGate.textContent = "Możesz przeglądać ten zestaw, ale dodawanie słówek jest dostępne tylko dla właściciela.";
        addWordForm.classList.add("is-hidden");
        addWordContext.textContent = "";
        importGate.classList.remove("is-hidden");
        importGate.textContent = "Import plików jest dostępny tylko dla właściciela tego zestawu.";
        importForm.classList.add("is-hidden");
        importContext.textContent = "";
    }

    renderWordTable();
    updateSummary();
}

function renderFlashcards() {
    if (!state.selectedSet || !state.flashcards.length) {
        flashcardsEmpty.classList.remove("is-hidden");
        flashcardsContent.classList.add("is-hidden");
        flashcardsEmpty.textContent = "Wybierz zestaw z przynajmniej jednym słówkiem, aby uruchomić fiszki.";
        return;
    }

    const card = state.flashcards[state.flashcardIndex];
    const showingTranslation = state.flashcardRevealed;
    flashcardsEmpty.classList.add("is-hidden");
    flashcardsContent.classList.remove("is-hidden");
    flashcardSideLabel.textContent = showingTranslation ? "Angielski" : "Polski";
    flashcardValue.textContent = showingTranslation ? card.en : card.pl;
    flashcardSubtitle.textContent = showingTranslation
        ? "To tłumaczenie aktywnego słówka. Możesz wrócić na stronę polską lub przejść dalej."
        : "Kliknij kartę albo przycisk, żeby zobaczyć tłumaczenie.";
    flashcardProgress.textContent = `Karta ${state.flashcardIndex + 1} z ${state.flashcards.length}`;
}

function renderTypingMode() {
    if (!state.selectedSet || !state.selectedSet.words.length) {
        typingEmpty.classList.remove("is-hidden");
        typingEmpty.textContent = "Wybierz zestaw z przynajmniej jednym słówkiem, aby ćwiczyć wpisywanie tłumaczeń.";
        typingForm.classList.add("is-hidden");
        typingContext.textContent = "-";
        return;
    }

    if (state.typingIndex >= state.selectedSet.words.length) {
        state.typingIndex = 0;
    }

    const word = state.selectedSet.words[state.typingIndex];
    typingEmpty.classList.add("is-hidden");
    typingForm.classList.remove("is-hidden");
    typingContext.textContent = `Przetłumacz na angielski: ${word.pl} (${state.typingIndex + 1} z ${state.selectedSet.words.length})`;
}

function getCorrectAnswerText(question) {
    return question.options[question.correct_option - 1];
}

function renderQuiz() {
    if (!state.selectedSet) {
        quizGate.classList.remove("is-hidden");
        quizBuilder.classList.add("is-hidden");
        quizGate.textContent = "Wybierz zestaw i dodaj do niego co najmniej 4 słówka, aby utworzyć quiz.";
        quizRender.innerHTML = "";
        return;
    }

    if (state.selectedSet.words.length < 4) {
        quizGate.classList.remove("is-hidden");
        quizBuilder.classList.add("is-hidden");
        quizGate.textContent = `Do quizu potrzebujesz jeszcze ${4 - state.selectedSet.words.length} słówek.`;
        quizRender.innerHTML = "";
        return;
    }

    quizGate.classList.add("is-hidden");
    quizBuilder.classList.remove("is-hidden");
    quizForm.elements.name.value = `${state.selectedSet.name} quiz`;

    if (!state.quiz) {
        quizRender.innerHTML = "";
        return;
    }

    const form = document.createElement("form");
    form.className = "quiz-questions";

    const resultsByQuestion = new Map((state.quizResult?.results || []).map((item) => [item.question_id, item]));

    state.quiz.questions.forEach((question, index) => {
        const card = document.createElement("section");
        card.className = "question-card";

        const title = document.createElement("h3");
        title.textContent = `${index + 1}. Jak po angielsku powiedzieć: ${question.pl}?`;
        card.appendChild(title);

        question.options.forEach((option, optionIndex) => {
            const label = document.createElement("label");
            label.className = "option-row";

            const input = document.createElement("input");
            input.type = "radio";
            input.name = `question-${question.id}`;
            input.value = (optionIndex + 1).toString();
            input.checked = state.quizAnswers[question.id] === optionIndex + 1;
            input.addEventListener("change", () => {
                state.quizAnswers[question.id] = optionIndex + 1;
                state.quizResult = null;
                setFeedbackState(quizFeedback);
            });

            const text = document.createElement("span");
            text.textContent = option;
            label.append(input, text);
            card.appendChild(label);
        });

        if (state.quizResult) {
            const result = resultsByQuestion.get(question.id);
            const note = document.createElement("p");
            note.className = result?.is_correct ? "result-note success" : "result-note error";
            note.textContent = result?.is_correct
                ? "Poprawna odpowiedź."
                : `Poprawna odpowiedź: ${result?.correct_answer || getCorrectAnswerText(question)}`;
            card.appendChild(note);
        }

        form.appendChild(card);
    });

    const actionRow = document.createElement("div");
    actionRow.className = "quiz-actions";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary-button";
    submit.textContent = "Sprawdź wynik";
    actionRow.appendChild(submit);
    form.appendChild(actionRow);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const unanswered = state.quiz.questions.some((question) => !state.quizAnswers[question.id]);
        if (unanswered) {
            setFeedbackState(quizFeedback, "Wybierz odpowiedzi na wszystkie pytania.", "error");
            return;
        }

        try {
            state.quizResult = await apiFetch(`/api/quizzes/${state.quiz.quiz.id}/submit/`, {
                method: "POST",
                body: JSON.stringify({ answers: state.quizAnswers }),
            }, true);
            setFeedbackState(
                quizFeedback,
                `Wynik: ${state.quizResult.correct_count}/${state.quizResult.total_questions} (${state.quizResult.score_percentage}%).`,
                "success"
            );
            renderQuiz();
        } catch (error) {
            setFeedbackState(quizFeedback, error.message, "error");
        }
    });

    const wrapper = document.createElement("div");
    wrapper.className = "quiz-wrapper";

    const quizTitle = document.createElement("div");
    quizTitle.className = "quiz-title";
    quizTitle.innerHTML = `<strong>${state.quiz.quiz.name}</strong><p class="section-copy">Quiz został wygenerowany z aktualnie wybranego zestawu.</p>`;
    wrapper.appendChild(quizTitle);
    wrapper.appendChild(form);

    if (state.quizResult) {
        const summary = document.createElement("div");
        summary.className = "result-banner";
        summary.textContent = `Masz ${state.quizResult.correct_count} poprawnych odpowiedzi na ${state.quizResult.total_questions}. Wynik: ${state.quizResult.score_percentage}%.`;
        wrapper.appendChild(summary);
    }

    quizRender.innerHTML = "";
    quizRender.appendChild(wrapper);
}

async function loadSelectedSet(setId) {
    const [set, flashcards] = await Promise.all([
        apiFetch(`/api/sets/${setId}/`, {}, true),
        apiFetch(`/api/sets/${setId}/flashcards/`, {}, true),
    ]);

    state.selectedSet = set;
    state.selectedSetId = set.id;
    state.flashcards = flashcards;
    state.flashcardIndex = 0;
    state.flashcardRevealed = false;
    state.typingIndex = 0;
    state.quiz = null;
    state.quizAnswers = {};
    state.quizResult = null;
    typingForm.reset();
    renderSetList();
    renderSelectedSet();
    renderFlashcards();
    renderTypingMode();
    renderQuiz();
}

async function selectSet(setId) {
    try {
        setFeedbackState(setFeedback);
        setFeedbackState(addWordFeedback);
        setFeedbackState(importFeedback);
        setFeedbackState(typingFeedback);
        setFeedbackState(quizFeedback);
        await loadSelectedSet(setId);
    } catch (error) {
        setFeedbackState(setFeedback, error.message, "error");
    }
}

async function loadSets() {
    if (!state.token) {
        return;
    }

    try {
        setsList.className = "sets-list empty-state";
        setsList.textContent = "Pobieram zestawy...";
        const sets = await apiFetch("/api/sets/", {}, true);
        state.sets = sets;
        renderSetList();
        updateSummary();

        const availableIds = new Set(sets.map((item) => item.id));
        const targetId = state.selectedSetId && availableIds.has(state.selectedSetId)
            ? state.selectedSetId
            : sets[0]?.id;

        if (targetId) {
            await loadSelectedSet(targetId);
        } else {
            state.selectedSet = null;
            state.selectedSetId = null;
            state.flashcards = [];
            renderSelectedSet();
            renderFlashcards();
            renderTypingMode();
            renderQuiz();
        }
    } catch (error) {
        setsList.className = "sets-list empty-state";
        setsList.textContent = error.message;
    }
}

async function deleteWord(wordId) {
    try {
        await apiFetch(`/api/words/${wordId}/delete/`, { method: "DELETE" }, true);
        setFeedbackState(addWordFeedback, "Słówko zostało usunięte.", "success");
        await loadSets();
    } catch (error) {
        setFeedbackState(addWordFeedback, error.message, "error");
    }
}

function moveFlashcard(step) {
    if (!state.flashcards.length) {
        return;
    }

    const total = state.flashcards.length;
    state.flashcardIndex = (state.flashcardIndex + step + total) % total;
    state.flashcardRevealed = false;
    renderFlashcards();
}

tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
        tabButtons.forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        registerForm.classList.toggle("is-hidden", button.dataset.tabTarget !== "register-form");
        loginForm.classList.toggle("is-hidden", button.dataset.tabTarget !== "login-form");
        setFeedbackState(authFeedback);
    });
});

scrollButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.scrollTarget);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
});

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);

    try {
        const data = await apiFetch("/api/register/", {
            method: "POST",
            body: JSON.stringify({
                username: formData.get("username"),
                password: formData.get("password"),
            }),
        });
        setAuth(data);
        registerForm.reset();
        setFeedbackState(authFeedback, data.message || "Konto zostało utworzone.", "success");
    } catch (error) {
        setFeedbackState(authFeedback, error.message, "error");
    }
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);

    try {
        const data = await apiFetch("/api/login/", {
            method: "POST",
            body: JSON.stringify({
                username: formData.get("username"),
                password: formData.get("password"),
            }),
        });
        setAuth(data);
        loginForm.reset();
        setFeedbackState(authFeedback, data.message || "Zalogowano pomyślnie.", "success");
    } catch (error) {
        setFeedbackState(authFeedback, error.message, "error");
    }
});

setForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        const formData = new FormData(setForm);
        const words = collectWordsFromBuilder();
        const created = await apiFetch("/api/sets/create/", {
            method: "POST",
            body: JSON.stringify({
                name: formData.get("name"),
                public: formData.get("public") === "on",
                words,
            }),
        }, true);

        setForm.reset();
        resetWordRows();
        setFeedbackState(
            setFeedback,
            `Zestaw "${created.set.name}" został utworzony${words.length ? ` i uzupełniony o ${words.length} słówek.` : "."}`,
            "success"
        );

        await loadSets();
        await selectSet(created.set.id);
    } catch (error) {
        setFeedbackState(setFeedback, error.message, "error");
    }
});

importForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.selectedSet || !isOwnSet(state.selectedSet)) {
        setFeedbackState(importFeedback, "Najpierw wybierz własny zestaw.", "error");
        return;
    }

    const file = importForm.elements.file.files[0];
    if (!file) {
        setFeedbackState(importFeedback, "Wybierz plik CSV lub JSON do importu.", "error");
        return;
    }

    try {
        const payload = new FormData();
        payload.append("file", file);

        const result = await apiFetch(`/api/sets/${state.selectedSet.id}/import/`, {
            method: "POST",
            body: payload,
        }, true);

        importForm.reset();
        setFeedbackState(importFeedback, result.message || "Import zakończony powodzeniem.", "success");
        await loadSets();
        await selectSet(state.selectedSet.id);
    } catch (error) {
        setFeedbackState(importFeedback, error.message, "error");
    }
});

addWordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.selectedSet) {
        setFeedbackState(addWordFeedback, "Najpierw wybierz zestaw.", "error");
        return;
    }

    try {
        const formData = new FormData(addWordForm);
        await apiFetch(`/api/sets/${state.selectedSet.id}/add_word/`, {
            method: "POST",
            body: JSON.stringify({
                pl: formData.get("pl"),
                en: formData.get("en"),
            }),
        }, true);

        addWordForm.reset();
        setFeedbackState(addWordFeedback, "Nowe słówko zostało dodane.", "success");
        await loadSets();
        await selectSet(state.selectedSet.id);
    } catch (error) {
        setFeedbackState(addWordFeedback, error.message, "error");
    }
});

typingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.selectedSet || !state.selectedSet.words.length) {
        setFeedbackState(typingFeedback, "Najpierw wybierz zestaw ze słówkami.", "error");
        return;
    }

    const word = state.selectedSet.words[state.typingIndex];
    const formData = new FormData(typingForm);

    try {
        const result = await apiFetch(`/api/words/${word.id}/check/`, {
            method: "POST",
            body: JSON.stringify({
                answer: formData.get("answer"),
            }),
        }, true);

        if (result.correct) {
            setFeedbackState(typingFeedback, "Poprawnie! To było dobre tłumaczenie.", "success");
        } else {
            setFeedbackState(typingFeedback, `Jeszcze nie. Poprawna odpowiedź: ${result.correct_answer}.`, "error");
        }
    } catch (error) {
        setFeedbackState(typingFeedback, error.message, "error");
    }
});

quizForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.selectedSet) {
        setFeedbackState(quizFeedback, "Najpierw wybierz zestaw.", "error");
        return;
    }

    try {
        const formData = new FormData(quizForm);
        const created = await apiFetch(`/api/sets/${state.selectedSet.id}/quiz/`, {
            method: "POST",
            body: JSON.stringify({
                name: formData.get("name"),
            }),
        }, true);

        state.quiz = await apiFetch(`/api/quizzes/${created.quiz_id}/`, {}, true);
        state.quizAnswers = {};
        state.quizResult = null;
        setFeedbackState(quizFeedback, "Quiz jest gotowy. Możesz zacząć rozwiązywanie.", "success");
        renderQuiz();
    } catch (error) {
        setFeedbackState(quizFeedback, error.message, "error");
    }
});

logoutButton.addEventListener("click", () => {
    clearAuth();
    setFeedbackState(setFeedback);
    setFeedbackState(addWordFeedback);
    setFeedbackState(importFeedback);
    setFeedbackState(typingFeedback);
    setFeedbackState(quizFeedback);
});

addWordRowButton.addEventListener("click", () => createWordRow());
refreshSetsButton.addEventListener("click", () => loadSets());
flashcardCard.addEventListener("click", () => {
    state.flashcardRevealed = !state.flashcardRevealed;
    renderFlashcards();
});
flipFlashcardButton.addEventListener("click", () => {
    state.flashcardRevealed = !state.flashcardRevealed;
    renderFlashcards();
});
nextTypingWordButton.addEventListener("click", () => {
    if (!state.selectedSet || !state.selectedSet.words.length) {
        return;
    }

    state.typingIndex = (state.typingIndex + 1) % state.selectedSet.words.length;
    typingForm.reset();
    setFeedbackState(typingFeedback);
    renderTypingMode();
});
prevFlashcardButton.addEventListener("click", () => moveFlashcard(-1));
nextFlashcardButton.addEventListener("click", () => moveFlashcard(1));

resetWordRows();
renderAuthState();
